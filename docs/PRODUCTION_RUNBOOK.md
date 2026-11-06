# Runbook — עלייה לייצור (אלפי שחקנים)

## ארכיטקטורה (למה תישנו בלילה)

| רכיב | תפקיד |
|--------|--------|
| **Cloud Functions** (`registerPlayer`, `submitOrder`, `advanceWorld`) | לוגיקה + כתיבות — אין תחרות מהקליינט |
| **Firestore rules** | קריאה ציבורית מוגבלת; **אין** כתיבה ישירה ל-world/players/orders |
| **`locks/worldAdvance`** | mutex — רק קידום עולם אחד בו-זמנית |
| **`rateLimits/*`** | throttle פush/פתיחת מסחר (800ms פקודה, 5s קידום) |
| **`cache/leaderboard`** | דירוג מוכן — הקליינט **לא** סורק את כל השחקנים |
| **`scheduledLeaderboard`** | כל 5 דק' — גיבוי אם cache stale |

## לפני עלייה מחר

```bash
cd house-of-finance
npm ci --legacy-peer-deps
cd functions && npm ci && npm run build && cd ..
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use <PROJECT_ID>
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes,functions
npm run build:web
npx -y firebase-tools@latest deploy --only hosting
```

ודאו `.env` ב-production עם `EXPO_PUBLIC_USE_CLOUD_FUNCTIONS=1`.

**אתחול עולם (פעם אחת):** אם `world/state` לא קיים — נוצר ב-`registerPlayer` / `advanceWorld`.

## בדיקת בריאות

מממשק מחובר Firebase (או script):

- Callable **`health`** — מחזיר `playerCount`, גיל cache דירוג, קיום world.

## תרחישי תקלה

### "העולם מתעדכן — נסו שוב"
- **סיבה:** mutex פעיל (`locks/worldAdvance`) או rate limit.
- **פעולה:** המתינו 90s; אם תקוע — מחקו ידנית `locks/worldAdvance` (Admin SDK / Console).

### דירוג ריק / stale
- **סיבה:** >900 שחקנים — rebuild inline דולג.
- **פעולה:** המתינו ל-`scheduledLeaderboard` (5 דק') או הריצו deploy functions; בדקו `cache/leaderboard.stale`.

### פקודות נדחות en masse
- בדקו `world/simMs`, שעות מסחר, יתרות.
- Cloud Logging → `submitOrder` errors.

### עלויות Firestore קופצות
- ודאו שאין build ישן שקורא `subscribeAllPlayers` + snapshots לכל שחקן.
- דירוג רק מ-`cache/leaderboard`.

## CI (מפתחים ביום)

`.github/workflows/ci.yml` — `tsc` + build functions על כל PR.

**כלל:** שינוי ב-`src/game/*` חייב לעבור CI + deploy functions לפני עלייה ל-hosting.

## מדדים ל-War Room (יום עלייה)

- Cloud Functions: error rate, p95 latency (`submitOrder`, `advanceWorld`)
- Firestore: write QPS, quota
- `health.playerCount` vs צפוי
- Completion rate יעד יומי (ראו DAILY_QUEST_RETENTION.md)

## חופשה — מה לא לעשות

- לא לפתוח write rules "זמנית".
- לא `advanceWorld` מ-client ישן (EXPO_PUBLIC_USE_CLOUD_FUNCTIONS=0) בפרוד.
- לא force-push ל-main בלי CI ירוק.

## Rollback

1. Hosting: `firebase hosting:rollback`
2. Functions: redeploy tag קודם מ-git
3. Rules: revert commit + `firebase deploy --only firestore:rules`
