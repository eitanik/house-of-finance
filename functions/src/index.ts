import { initializeApp } from 'firebase-admin/app';
import {
  FieldPath,
  FieldValue,
  getFirestore,
  Timestamp,
  type QueryDocumentSnapshot,
  type WriteBatch,
} from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { advanceSimMinutes, initialWorldState, snapshotPlayers } from '../../src/game/engine';
import { validateNewOrder } from '../../src/game/orders';
import { buildLeaderboard } from '../../src/game/scoring';
import { getWorldSeries } from '../../src/game/worldGen';
import type { LeaderboardCache } from '../../src/game/weekMetrics';
import type { Order, Player, PortfolioSnapshot, WorldState } from '../../src/game/types';
import { STARTING_CASH_ILS } from '../../src/game/types';
import { onPlayerAdvance, onPlayerOrder, touchPlayerDaily } from '../../src/services/dailyQuestPlayer';
import { refreshHoldingsQuest } from '../../src/game/dailyQuest';

initializeApp();
const db = getFirestore();

const REGION = 'europe-west1';
const MAX_ADVANCE_MINUTES = 480;
const MIN_ADVANCE_MINUTES = 1;
const RATE_SUBMIT_MS = 800;
const RATE_ADVANCE_MS = 5000;
const LOCK_MS = 90_000;

async function rateLimit(uid: string, action: string, windowMs: number): Promise<void> {
  const ref = db.doc(`rateLimits/${uid}_${action}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const last = snap.data()?.lastMs ?? 0;
    if (now - last < windowMs) {
      throw new HttpsError('resource-exhausted', 'יותר מדי בקשות — נסו שוב בעוד רגע');
    }
    tx.set(ref, { lastMs: now, action, uid });
  });
}

async function commitInChunks(ops: ((batch: WriteBatch) => void)[]): Promise<void> {
  const CHUNK = 450;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = db.batch();
    ops.slice(i, i + CHUNK).forEach((fn) => fn(batch));
    await batch.commit();
  }
}

async function paginatePlayers(): Promise<Record<string, Player>> {
  const map: Record<string, Player> = {};
  let cursor: QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = db.collection('players').orderBy(FieldPath.documentId()).limit(400);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      map[d.id] = d.data() as Player;
    }
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < 400) break;
  }
  return map;
}

async function loadPendingOrders(): Promise<Order[]> {
  const snap = await db.collection('orders').where('status', '==', 'pending').limit(2000).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
}

async function loadRecentSnapshots(uid: string, limit = 80): Promise<PortfolioSnapshot[]> {
  const snap = await db
    .collection('players')
    .doc(uid)
    .collection('snapshots')
    .orderBy('simMs', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as PortfolioSnapshot).reverse();
}

async function rebuildLeaderboardCache(simMs: number): Promise<void> {
  const players: { uid: string; displayName: string; snapshots: PortfolioSnapshot[]; dailyQuest?: Player['dailyQuest'] }[] = [];
  let cursor: QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = db.collection('players').orderBy(FieldPath.documentId()).limit(100);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      const p = d.data() as Player;
      const snapshots = await loadRecentSnapshots(d.id);
      players.push({
        uid: d.id,
        displayName: p.displayName,
        snapshots,
        dailyQuest: p.dailyQuest,
      });
    }
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < 100) break;
  }
  const rows = buildLeaderboard(players, simMs);
  const cache: LeaderboardCache = { updatedAt: Date.now(), simMs, rows };
  await db.doc('cache/leaderboard').set(cache);
}

export const registerPlayer = onCall({ region: REGION, maxInstances: 100 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'נדרשת התחברות');
  const uid = req.auth.uid;
  const displayName = (req.data?.displayName as string)?.trim();
  if (!displayName || displayName.length > 40) {
    throw new HttpsError('invalid-argument', 'שם לא תקין');
  }

  const ref = db.doc(`players/${uid}`);
  const existing = await ref.get();
  if (existing.exists) {
    const touched = touchPlayerDaily(existing.data() as Player);
    await ref.update({ dailyQuest: touched.dailyQuest, displayName });
    return { ok: true, player: touched };
  }

  const worldSnap = await db.doc('world/state').get();
  if (!worldSnap.exists) {
    await db.doc('world/state').set(initialWorldState());
  }
  const world = (worldSnap.data() ?? initialWorldState()) as WorldState;

  let player: Player = {
    uid,
    displayName,
    cashIls: STARTING_CASH_ILS,
    holdings: {},
    createdAt: Date.now(),
  };
  player = touchPlayerDaily(player);
  await ref.set(player);
  await ref.collection('snapshots').doc(String(world.simMs)).set({
    simMs: world.simMs,
    totalIls: STARTING_CASH_ILS,
  });
  return { ok: true, player };
});

export const submitOrder = onCall({ region: REGION, maxInstances: 200 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'נדרשת התחברות');
  const uid = req.auth.uid;
  await rateLimit(uid, 'submitOrder', RATE_SUBMIT_MS);

  const symbol = req.data?.symbol as string;
  const side = req.data?.side as 'buy' | 'sell';
  const amountIls = Number(req.data?.amountIls);
  if (!symbol || (side !== 'buy' && side !== 'sell') || !(amountIls > 0)) {
    throw new HttpsError('invalid-argument', 'פרמטרים לא תקינים');
  }

  const worldRef = db.doc('world/state');
  const worldSnap = await worldRef.get();
  if (!worldSnap.exists) await worldRef.set(initialWorldState());
  const world = (worldSnap.data() ?? initialWorldState()) as WorldState;

  const playerRef = db.doc(`players/${uid}`);
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) throw new HttpsError('failed-precondition', 'שחקן לא נמצא');
  const player = playerSnap.data() as Player;

  const series = getWorldSeries(world.seed, world.epochDate);
  const err = validateNewOrder(side, amountIls, symbol, player, series, world.simMs);
  if (err) throw new HttpsError('failed-precondition', err);

  const orderRef = db.collection('orders').doc();
  const order: Omit<Order, 'id'> = {
    userId: uid,
    symbol,
    side,
    amountIls,
    submittedAtSimMs: world.simMs,
    status: 'pending',
  };
  await orderRef.set({ ...order, createdAt: FieldValue.serverTimestamp() });

  const updated = onPlayerOrder(player, symbol, side, amountIls);
  await playerRef.update({ dailyQuest: updated.dailyQuest });

  return { ok: true, orderId: orderRef.id };
});

export const advanceWorld = onCall({ region: REGION, timeoutSeconds: 540, memory: '1GiB', maxInstances: 5 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'נדרשת התחברות');
  const uid = req.auth.uid;
  await rateLimit(uid, 'advanceWorld', RATE_ADVANCE_MS);

  const minutes = Math.floor(Number(req.data?.minutes));
  if (!(minutes >= MIN_ADVANCE_MINUTES && minutes <= MAX_ADVANCE_MINUTES)) {
    throw new HttpsError('invalid-argument', 'טווח דקות לא תקין');
  }

  const lockRef = db.doc('locks/worldAdvance');
  const acquired = await db.runTransaction(async (tx) => {
    const lock = await tx.get(lockRef);
    const now = Date.now();
    if (lock.exists && (lock.data()?.untilMs ?? 0) > now) {
      return false;
    }
    tx.set(lockRef, { untilMs: now + LOCK_MS, by: uid, startedAt: now });
    return true;
  });
  if (!acquired) {
    throw new HttpsError('resource-exhausted', 'העולם מתעדכן — נסו שוב בעוד כמה שניות');
  }

  try {
    const worldRef = db.doc('world/state');
    const worldSnap = await worldRef.get();
    const world = (worldSnap.data() ?? initialWorldState()) as WorldState;

    const players = await paginatePlayers();
    const orders = await loadPendingOrders();

    const result = advanceSimMinutes(world, players, orders, minutes);

    const writeOps: ((batch: WriteBatch) => void)[] = [];
    writeOps.push((batch) =>
      batch.update(worldRef, { simMs: result.world.simMs, lastAdvancedAt: FieldValue.serverTimestamp() }),
    );

    for (const [id, p] of Object.entries(result.players)) {
      let withDaily = onPlayerAdvance(p, minutes);
      withDaily = {
        ...withDaily,
        dailyQuest: refreshHoldingsQuest(withDaily.dailyQuest!, withDaily.holdings),
      };
      const ref = db.doc(`players/${id}`);
      writeOps.push((batch) =>
        batch.update(ref, {
          cashIls: withDaily.cashIls,
          holdings: withDaily.holdings,
          dailyQuest: withDaily.dailyQuest,
        }),
      );
    }

    for (const o of result.orders) {
      if (o.status === 'pending') continue;
      const ref = db.doc(`orders/${o.id}`);
      writeOps.push((batch) =>
        batch.update(ref, {
          status: o.status,
          rejectReason: o.rejectReason ?? null,
          filledAtSimMs: o.filledAtSimMs ?? null,
          fillPriceNative: o.fillPriceNative ?? null,
          fillFx: o.fillFx ?? null,
          fillQty: o.fillQty ?? null,
          fillAmountIls: o.fillAmountIls ?? null,
        }),
      );
    }

    const snaps = snapshotPlayers(result.world, result.players, result.world.simMs);
    for (const { uid: puid, snapshot } of snaps) {
      const ref = db.doc(`players/${puid}/snapshots/${snapshot.simMs}`);
      writeOps.push((batch) => batch.set(ref, snapshot));
    }

    await commitInChunks(writeOps);

    const countSnap = await db.collection('players').count().get();
    const playerCount = countSnap.data().count;
    if (playerCount <= 900) {
      await rebuildLeaderboardCache(result.world.simMs);
    } else {
      await db.doc('cache/leaderboard').set({
        updatedAt: Date.now(),
        simMs: result.world.simMs,
        rows: [],
        stale: true,
      });
    }

    return { ok: true, simMs: result.world.simMs };
  } finally {
    await lockRef.set({ untilMs: Date.now(), by: uid, releasedAt: FieldValue.serverTimestamp() });
  }
});

export const health = onCall({ region: REGION }, async () => {
  const world = await db.doc('world/state').get();
  const lb = await db.doc('cache/leaderboard').get();
  const players = await db.collection('players').count().get();
  return {
    ok: true,
    world: world.exists,
    leaderboardCacheAge: lb.exists ? Date.now() - (lb.data()?.updatedAt ?? 0) : null,
    playerCount: players.data().count,
    ts: Timestamp.now().toMillis(),
  };
});

/** Safety net if advance succeeded but cache stale. */
export const scheduledLeaderboard = onSchedule(
  { schedule: 'every 5 minutes', region: REGION, timeoutSeconds: 300, memory: '512MiB' },
  async () => {
    const worldSnap = await db.doc('world/state').get();
    if (!worldSnap.exists) return;
    const simMs = (worldSnap.data() as WorldState).simMs;
    await rebuildLeaderboardCache(simMs);
  },
);
