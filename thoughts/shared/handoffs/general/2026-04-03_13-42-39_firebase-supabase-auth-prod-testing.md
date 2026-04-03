---
date: 2026-04-03T13:42:39-05:00
researcher: pakhunchan
git_commit: 6e9d6a7639476190658661cbfcbfa59f4112b287
branch: main
repository: ChatBridge
topic: "Firebase + Supabase Auth, S3 Demo Video, Prod Deployment"
tags: [firebase, supabase, auth, vercel, chess-plugin, playwright, s3, deployment]
status: complete
last_updated: 2026-04-03
last_updated_by: pakhunchan
type: implementation_strategy
plan_path: null
plan_status: null
plan_phase: null
---

# Handoff: Firebase + Supabase Auth, S3 Demo Video, Prod Deployment

## Task(s)

- **Completed**: S3 bucket creation and demo video upload (`chatbridge.pakhunchan.com/demo-video`)
- **Completed**: Firebase + Supabase auth integration with Vercel Edge Function for token exchange
- **Completed**: Sign Out button added to sidebar
- **Completed**: SPA routing fix (catch-all rewrite in `app/vercel.json`)
- **Completed**: Dev/prod URL switching for chess plugin iframe
- **Completed**: Vite dev proxy for `/api` routes to production Vercel
- **Completed**: All changes committed and pushed to `origin` (labs.gauntletai.com)
- **In Progress**: Push to `old-origin` (github.com/pakhunchan/ChatBridge) to trigger Vercel deploy
- **Planned/Discussed**: Full end-to-end Playwright test on prod (`chatbridge.pakhunchan.com`)
- **Planned/Discussed**: Fix Supabase RLS policies so `syncUserToSupabase` and `loadApiKeysFromSupabase` work
- **Planned/Discussed**: Seed User123 demo account API key in Supabase after RLS fix
- **Planned/Discussed**: Clean up debug logging in edge function (`app/api/auth/supabase-token.ts`)

## Critical References

1. `app/api/auth/supabase-token.ts` — Vercel Edge Function that verifies Firebase ID token and mints Supabase JWT. Still has debug logging in catch block to clean up.
2. `app/vercel.json` — Contains SPA catch-all rewrite and `/demo-video` proxy to S3. API routes are preserved before the catch-all.
3. `app/src/renderer/packages/supabase/config.ts` — Supabase client with `exchangeFirebaseToken()` function and `Proxy` export.

## Recent Changes

- `app/api/auth/supabase-token.ts` — new Vercel Edge Function for Firebase-to-Supabase token exchange
- `app/src/renderer/packages/supabase/config.ts` — added `exchangeFirebaseToken()` and updated client setup
- `app/src/renderer/routes/login.tsx` — calls `exchangeFirebaseToken` after all auth flows complete
- `app/src/renderer/setup/firebase_auth_bootstrap.ts` — exchanges token on page load
- `app/src/renderer/Sidebar.tsx` — added Sign Out button for both desktop and mobile views; calls `signOut(auth)` + `firebaseAuthStore.clear()` + navigate to `/login`
- `app/vercel.json` — added `/demo-video` S3 proxy rewrite and SPA catch-all rewrite
- `app/src/renderer/packages/plugins/manifests/chess.ts` — `iframeUrl` uses `import.meta.env.DEV` to toggle localhost vs prod URL
- `app/electron.vite.config.ts` — added `server.proxy` to forward `/api` requests to prod Vercel during local dev
- `app/src/renderer/packages/firebase/` — new directory (untracked, contains Firebase config)
- `app/src/renderer/packages/supabase/` — new directory (untracked, contains Supabase config)
- `app/src/renderer/stores/firebaseAuthStore.ts` — new Zustand store for Firebase auth state

## Learnings

- Vercel env vars must be set with `printf` (not `echo`) to avoid trailing newline in secret values — a trailing newline in `SUPABASE_JWT_SECRET` causes JWT verification failures.
- The minted Supabase JWT uses HS256 with the legacy JWT secret. The `sub` claim must match what Supabase RLS policies expect — this is currently broken and needs investigation.
- `api.chatboxai.app` CORS errors in the browser console are from upstream chatboxai code (not our code) — they are harmless noise.
- Chrome must be fully closed before Playwright can launch due to conflicts with existing Chrome sessions.
- The Vercel project is `chatbridge-app` in `pakhunchan-3528s-projects`. Deploys are triggered by pushes to `old-origin` (github.com/pakhunchan/ChatBridge), not `origin` (labs.gauntletai.com).
- Vite cache can cause `createTheme_default is not a function` — fix with `rm -rf app/node_modules/.vite`.
- `app/.env` is gitignored and contains Firebase, Supabase, and OpenAI credentials for local dev. Line 1 has the OpenAI API key needed for prod testing.

## Artifacts

- `/Users/jackie/src/ChatBridge/app/api/auth/supabase-token.ts` — new Vercel Edge Function
- `/Users/jackie/src/ChatBridge/app/vercel.json` — updated with S3 proxy and SPA catch-all
- `/Users/jackie/src/ChatBridge/app/src/renderer/packages/supabase/config.ts` — updated with token exchange
- `/Users/jackie/src/ChatBridge/app/src/renderer/packages/supabase/` — new directory
- `/Users/jackie/src/ChatBridge/app/src/renderer/packages/firebase/` — new directory
- `/Users/jackie/src/ChatBridge/app/src/renderer/stores/firebaseAuthStore.ts` — new store
- `/Users/jackie/src/ChatBridge/app/src/renderer/routes/login.tsx` — updated with token exchange call
- `/Users/jackie/src/ChatBridge/app/src/renderer/setup/firebase_auth_bootstrap.ts` — updated with token exchange on load
- `/Users/jackie/src/ChatBridge/app/src/renderer/Sidebar.tsx` — updated with Sign Out button
- `/Users/jackie/src/ChatBridge/app/src/renderer/packages/plugins/manifests/chess.ts` — updated with dev/prod URL switching
- `/Users/jackie/src/ChatBridge/app/electron.vite.config.ts` — updated with dev API proxy

## Action Items & Next Steps

- [ ] Push to `old-origin` to trigger Vercel deploy: `git -C /Users/jackie/src/ChatBridge push old-origin main`
- [ ] Verify deploy completes in Vercel dashboard for project `chatbridge-app`
- [ ] Run Playwright end-to-end test on prod (`chatbridge.pakhunchan.com`):
  1. Navigate to `https://chatbridge.pakhunchan.com`
  2. Sign out if already signed in
  3. Click "Login as User123 (API key included)"
  4. Verify login succeeds (token exchange returns a Supabase JWT without error)
  5. Set up OpenAI API key in Settings (key is in `app/.env` line 1)
  6. Select GPT-4o model
  7. Send "Let's play chess! I'll be white, easy difficulty."
  8. Verify chess plugin iframe loads from `https://chatbridge-chess.pakhunchan.com` (not localhost)
  9. Play a few moves via chat
  10. Ask LLM to analyze the board
  11. Check browser console for ChatBridge-specific errors (ignore `api.chatboxai.app` CORS errors)
- [ ] Investigate and fix Supabase RLS policies so JWT `sub` claim matches policy expectations
- [ ] Seed User123 demo account API key in Supabase after RLS is fixed
- [ ] Clean up debug logging in catch block of `app/api/auth/supabase-token.ts`

## Other Notes

### Key URLs
- Prod app: `https://chatbridge.pakhunchan.com`
- Chess plugin (prod): `https://chatbridge-chess.pakhunchan.com`
- Demo video: `https://chatbridge.pakhunchan.com/demo-video` (30MB, may be cached for 24hrs)
- Vercel project: `chatbridge-app` in `pakhunchan-3528s-projects`

### Git Remotes
- `origin` = labs.gauntletai.com (does NOT trigger Vercel)
- `old-origin` = github.com/pakhunchan/ChatBridge (triggers Vercel deploy)

### Running Locally
- Main app: `cd /Users/jackie/src/ChatBridge/app && nvm use 22 && pnpm run dev:web` (web mode at localhost:1212)
- Chess plugin: `cd /Users/jackie/src/ChatBridge/plugins/chess && npm run dev` (localhost:5173)
- Both must be running for chess to work locally
- If you see `createTheme_default is not a function`: `rm -rf /Users/jackie/src/ChatBridge/app/node_modules/.vite`

### Vercel Edge Function Details
The edge function at `app/api/auth/supabase-token.ts`:
- Accepts a POST with `{ idToken: string }` in the body
- Fetches Google's public JWKS to verify the Firebase ID token
- Mints an HS256 JWT signed with `SUPABASE_JWT_SECRET` using the `jose` library
- Returns `{ token: string }` on success
- Server-side env vars required: `SUPABASE_JWT_SECRET`, `FIREBASE_PROJECT_ID`

### Supabase RLS Issue (Known Blocker)
The `syncUserToSupabase` and `loadApiKeysFromSupabase` calls currently fail. The minted JWT's `sub` claim does not match what the RLS policies expect. Investigation needed — likely need to either:
  - Update RLS policies to accept Firebase UID as `sub`, or
  - Map Firebase UID to Supabase user UUID and use that as `sub`
