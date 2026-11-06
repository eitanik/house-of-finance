# Connect House of Finance to Firebase + Vercel

## Architecture

```
[Browser on Vercel URL]  →  Firebase Auth + Firestore (reads) + Callable Functions
                                      ↑
                         Cloud Functions, Rules, Indexes (Firebase only)
```

| Platform | Role |
|----------|------|
| **Vercel** | Hosts the Expo **web** static build (`dist/`) |
| **Firebase Auth** | Sign-in (Anonymous / Email) |
| **Firestore** | Game data (`world`, `players`, `orders`, `cache/leaderboard`) |
| **Cloud Functions** | `registerPlayer`, `submitOrder`, `advanceWorld`, `health` |

You do **not** need Firebase Hosting if the app lives on Vercel.

---

## Part 1 — Firebase (backend)

### 1. Create / open a project

1. Go to [Firebase Console](https://console.firebase.google.com).
2. Create a project or pick an existing one.
3. Upgrade to the **Blaze (pay-as-you-go)** plan — required for Cloud Functions and the scheduled leaderboard job.

### 2. Enable products

**Authentication**

- Open **Authentication → Sign-in method**.
- Enable **Anonymous** (guest login in the app).
- Enable **Email/Password** if you use email sign-up.

**Firestore**

- **Firestore Database → Create database**.
- Pick a region close to your users (e.g. `europe-west1` / EU multi-region).

### 3. Register a Web app (config keys)

1. **Project settings** (gear) → **Your apps** → **Web** (`</>`).
2. Register the app and copy the config object values — you will paste them into Vercel as environment variables (see Part 2).

### 4. Deploy rules, indexes, and functions (from your machine)

```bash
cd house-of-finance

npx -y firebase-tools@latest login
npx -y firebase-tools@latest use YOUR_PROJECT_ID

cd functions
npm ci
npm run build
cd ..

npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes,functions
```

Skip `firebase deploy --only hosting` when using Vercel for the frontend.

Functions run in **`europe-west1`** (must match the client in `src/firebase/config.ts`).

### 5. Authorize your Vercel domain (Auth)

**Authentication → Settings → Authorized domains** — add:

- `localhost` (local dev)
- `your-project.vercel.app` (default Vercel URL)
- Any **custom domain** you attach in Vercel

Without this, sign-in fails with `auth/unauthorized-domain`.

---

## Part 2 — Vercel (frontend)

### 1. Import the repository

1. [vercel.com](https://vercel.com) → **Add New… → Project** → import from GitHub/GitLab.
2. If the repo root is the parent folder, set **Root Directory** to **`house-of-finance`**.

### 2. Build settings

The repo includes [`vercel.json`](../vercel.json):

| Setting | Value |
|---------|--------|
| Install Command | `npm ci --legacy-peer-deps` |
| Build Command | `npm run build:web` |
| Output Directory | `dist` |
| Framework | Other / None |

### 3. Environment variables (required)

**Project → Settings → Environment Variables**

Add these for **Production** (and **Preview** if you want staging previews):

| Name | Notes |
|------|--------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | From Firebase Web app config |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Usually `PROJECT_ID.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional — enables **Analytics** on Web (`G-…`) |
| `EXPO_PUBLIC_USE_CLOUD_FUNCTIONS` | Set to **`1`** for production |

**Important:** Expo inlines `EXPO_PUBLIC_*` at **build time**. After changing env vars in Vercel, trigger a **new deployment** (Redeploy).

Optional local file: copy [`.env.example`](../.env.example) to `.env` for `expo start --web`.

### 4. Deploy

Push to the connected branch or click **Deploy**. Your app URL will look like:

`https://your-project.vercel.app`

Add that hostname to Firebase **Authorized domains** (step 1.5).

---

## Verify end-to-end

1. Open the Vercel URL.
2. Sign in (guest or email) → **Trade** tab → submit an order.
3. **World** tab → advance time.
4. **Leaderboard** — may fill after time advance or within ~5 minutes (scheduled cache rebuild).
5. Firebase Console → **Functions → Logs** — no errors on `submitOrder` / `advanceWorld`.
6. Firestore — documents appear under `world/state`, `players/…`, `orders/…`, `cache/leaderboard`.

Optional: call the **`health`** callable (signed-in user) to check world + player count.

---

## Common issues

| Symptom | Fix |
|---------|-----|
| `auth/unauthorized-domain` | Add Vercel URL to Firebase Auth authorized domains |
| App behaves like **local demo** (no sync) | Set all `EXPO_PUBLIC_FIREBASE_*` + `EXPO_PUBLIC_USE_CLOUD_FUNCTIONS=1`, then redeploy |
| Callable functions fail | Blaze plan, deploy functions, check Logs |
| Empty leaderboard | Advance world once or wait for scheduled rebuild; see [PRODUCTION_RUNBOOK.md](./PRODUCTION_RUNBOOK.md) |
| CORS / `internal` on functions | Redeploy functions; ensure region `europe-west1` |

---

## Staging vs production

- **Two Firebase projects** (`hof-staging`, `hof-prod`) is the safest approach.
- **Vercel:** use different env vars for **Preview** vs **Production**.
- Always run `firebase use PROJECT_ID` before deploying functions to the correct project.

---

## Local development

```bash
cd house-of-finance
cp .env.example .env
# Fill in Firebase keys; EXPO_PUBLIC_USE_CLOUD_FUNCTIONS=1 if testing against deployed functions
npm install --legacy-peer-deps
npm run web
```

To use the **Functions emulator** (advanced): set `EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR=1` and run emulators — not required for production.

---

## Related docs

- [PRODUCTION_RUNBOOK.md](./PRODUCTION_RUNBOOK.md) — scale, locks, rollback
- [DAILY_QUEST_RETENTION.md](./DAILY_QUEST_RETENTION.md) — daily quest feature
