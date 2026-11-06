import { httpsCallable } from 'firebase/functions';

import { getFbFunctions, isFirebaseConfigured } from '../firebase/config';
import type { LeaderboardCache } from '../game/weekMetrics';
import type { Player } from '../game/types';

export function useCloudApi(): boolean {
  return isFirebaseConfigured() && process.env.EXPO_PUBLIC_USE_CLOUD_FUNCTIONS !== '0';
}

function isObj(e: unknown): e is Record<string, unknown> {
  return typeof e === 'object' && e !== null;
}

/**
 * Callable failures often surface as `functions/internal` with `[0]` when the
 * browser cannot complete the HTTPS request (CORS/network/ad-block), not when the function threw.
 */
function parseCallableError(e: unknown): string {
  if (isObj(e) && typeof e.code === 'string') {
    const code = e.code;
    const msg = typeof e.message === 'string' ? e.message : '';
    const urlFromDetails =
      isObj(e.customData) && typeof e.customData.url === 'string' ? e.customData.url : undefined;

    if (code === 'functions/not-found') {
      return 'הפונקציה לא קיימת או לא נפרסה. הריצו: firebase deploy --only functions (ולוודא אזור europe-west1).';
    }
    if (code === 'functions/unauthenticated') {
      return 'נדרשת התחברות מחדש — נסו להתנתק ולהתחבר שוב.';
    }
    if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded') {
      return 'השרת זמנית לא זמין — נסו שוב בעוד רגע.';
    }
    if (code === 'functions/failed-precondition') {
      return msg || code;
    }
    if (code === 'functions/internal' && /\[\s*0\s*\]/.test(msg)) {
      return [
        'לא ניתן להגיע ל־Cloud Functions מהדפדפן (רשת/CORS/חוסם פרסומות).',
        'בדקו: חיבור אינטרנט, כיבוי חוסם ל־cloudfunctions.net, ו־VPN.',
        'אם הפונקציות עדיין לא נפרסו: firebase deploy --only functions.',
        urlFromDetails ? `URL: ${urlFromDetails}` : '',
      ]
        .filter(Boolean)
        .join(' ');
    }
    if (code.startsWith('functions/')) {
      return [msg, urlFromDetails ? `(${urlFromDetails})` : ''].filter(Boolean).join(' ');
    }
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

export async function apiRegisterPlayer(displayName: string): Promise<Player> {
  try {
    const fn = httpsCallable<{ displayName: string }, { ok: boolean; player: Player }>(
      getFbFunctions(),
      'registerPlayer',
    );
    const res = await fn({ displayName });
    if (!res.data?.player) throw new Error('תשובה לא תקינה מהשרת (registerPlayer)');
    return res.data.player;
  } catch (e) {
    throw new Error(parseCallableError(e));
  }
}

export async function apiSubmitOrder(
  symbol: string,
  side: 'buy' | 'sell',
  amountIls: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const fn = httpsCallable<
      { symbol: string; side: 'buy' | 'sell'; amountIls: number },
      { ok: boolean; orderId: string }
    >(getFbFunctions(), 'submitOrder');
    await fn({ symbol, side, amountIls });
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: parseCallableError(e) };
  }
}

export async function apiAdvanceWorld(minutes: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const fn = httpsCallable<{ minutes: number }, { ok: boolean; simMs: number }>(
      getFbFunctions(),
      'advanceWorld',
    );
    await fn({ minutes });
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: parseCallableError(e) };
  }
}

export async function apiHealth(): Promise<Record<string, unknown>> {
  const fn = httpsCallable<void, Record<string, unknown>>(getFbFunctions(), 'health');
  const res = await fn();
  return res.data;
}
