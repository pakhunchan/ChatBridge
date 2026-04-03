# Fix Supabase RLS Authentication

**Date:** 2026-04-03
**Status:** Draft
**Priority:** High — blocks user sync and API key loading on prod

## Problem Summary

After Firebase login, the edge function at `app/api/auth/supabase-token.ts` mints an HS256 JWT and returns it to the client. The client sets this JWT on the Supabase client via `setSupabaseAccessToken()`. When the client then calls Supabase PostgREST endpoints (`users` upsert, `api_keys` select), Supabase returns **401** with:

```
PGRST301: None of the keys was able to decode the JWT
```

This means PostgREST cannot verify the JWT signature at all — it's not even getting to the RLS policy evaluation stage.

## Root Cause Analysis

### Primary cause: Trailing newline in `SUPABASE_JWT_SECRET` on Vercel

**Evidence:** The Firebase API key in network requests shows `%0A` (URL-encoded newline) appended:
```
identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyDvxLRPwrN92dwT87lBU9oYPEJO2EN9Cz4%0A
```

This proves that at least one Vercel env var was set with `echo` (which appends `\n`) rather than `printf` (which doesn't). The handoff from the previous session explicitly warned about this:

> Vercel env vars must be set with `printf` (not `echo`) to avoid trailing newline in secret values

The edge function signs the JWT with `new TextEncoder().encode(supabaseJwtSecret)`. If the secret has a trailing `\n`, the resulting signature won't match what Supabase expects (Supabase stores the secret without trailing whitespace).

### Secondary concern: JWT `sub` claim vs RLS policies

Even after fixing the signing key, RLS policies may reject queries because:
- The minted JWT sets `sub` to the **Firebase UID** (e.g., `G6qdHk8ER0ff9e7dsjdmNDSUf8m2`)
- Standard Supabase RLS policies use `auth.uid()` which reads from `sub`
- The `users` table uses Firebase UID as the `id` column
- The `api_keys` table filters by `user_id` = Firebase UID

If the RLS policies were created with standard Supabase templates (e.g., `auth.uid() = id`), they should work because `sub` = Firebase UID = `id`. But this needs verification once the signing key is fixed.

## Implementation Plan

### Phase 1: Fix the JWT signing key (Vercel env var)

**Goal:** Make Supabase accept the minted JWT.

1. **Get the correct JWT secret from Supabase Dashboard**
   - Go to Supabase Dashboard > Project `lneemsqczcdttkjgqcrv` > Settings > API
   - Copy the "JWT Secret" value exactly

2. **Re-set `SUPABASE_JWT_SECRET` on Vercel using `printf`**
   ```bash
   # Delete the existing (corrupted) value
   vercel env rm SUPABASE_JWT_SECRET production

   # Re-add without trailing newline
   printf '%s' 'THE_ACTUAL_SECRET' | vercel env add SUPABASE_JWT_SECRET production
   ```

3. **Also fix `VITE_FIREBASE_API_KEY`** (confirmed to have `%0A`)
   ```bash
   vercel env rm VITE_FIREBASE_API_KEY production
   printf '%s' 'AIzaSyDvxLRPwrN92dwT87lBU9oYPEJO2EN9Cz4' | vercel env add VITE_FIREBASE_API_KEY production
   ```

4. **Audit ALL Vercel env vars** for trailing newlines
   - Check each env var with `vercel env pull .env.vercel-check` and inspect for `\n`
   - Re-set any that have trailing whitespace

5. **Redeploy**
   ```bash
   git push old-origin main
   ```
   Or trigger a redeploy from the Vercel dashboard.

6. **Verify:** Navigate to prod, login as User123, check browser console. The `PGRST301` error should be gone. The `users` upsert and `api_keys` select should return 200.

### Phase 2: Verify RLS policies are applied correctly

**Goal:** Confirm the existing RLS policies work with the fixed JWT.

The schema is defined in `app/src/renderer/packages/supabase/schema.sql` (run manually in Supabase SQL Editor — no automated migrations). RLS policies already use the correct claim extraction pattern:

```sql
current_setting('request.jwt.claims', true)::json->>'sub'
```

**Actual policies (from schema.sql):**

| Table | Policy | Condition |
|-------|--------|-----------|
| `users` | SELECT | `id = ...->>'sub'` |
| `users` | UPDATE | `id = ...->>'sub'` |
| `users` | INSERT | `WITH CHECK (true)` — open insert |
| `api_keys` | ALL | `user_id = ...->>'sub'` |
| `sessions` | ALL | `user_id = ...->>'sub'` |
| `messages` | ALL | `session_id IN (SELECT id FROM sessions WHERE user_id = ...->>'sub')` |

These policies are correct for our JWT structure (`sub` = Firebase UID = `users.id` = `api_keys.user_id`). Once Phase 1 fixes the signing key, these should Just Work.

1. **Verify the schema was actually applied** in the Supabase SQL Editor:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
   SELECT policyname, tablename, cmd, qual FROM pg_policies WHERE schemaname = 'public';
   ```

2. **If tables/policies are missing**, re-run `schema.sql` from the Supabase SQL Editor.

3. **Test after Phase 1**: Login as User123, check console — `syncUserToSupabase` and `loadApiKeysFromSupabase` should return 200.

### Phase 3: Harden the edge function

**Goal:** Make the token exchange more robust and easier to debug.

1. **Trim the JWT secret in the edge function** as a defensive measure:
   ```typescript
   // app/api/auth/supabase-token.ts
   const secret = new TextEncoder().encode(supabaseJwtSecret.trim())
   ```
   This ensures trailing whitespace in the env var never causes a signing mismatch again.

2. **Add the `aud` claim** to the minted JWT. Supabase expects `aud: "authenticated"` by default:
   ```typescript
   const supabaseToken = await new SignJWT({
     sub: uid,
     role: 'authenticated',
     aud: 'authenticated',    // <-- add this
     iss: 'supabase',
     iat: now,
     exp: now + 3600,
   })
   ```

3. **Clean up the debug logging** — the catch block currently exposes internal error details. Replace with a generic error for non-dev environments (or just leave the clean version that's already there).

4. **Add a health check / debug endpoint** (optional, dev-only):
   Create `app/api/auth/debug-token.ts` that accepts a JWT and decodes it (without verifying) to show the header and payload. Only enable in non-production or behind a secret. This helps diagnose future JWT issues without needing browser devtools.

### Phase 4: Seed demo user API key

**Goal:** Make the "Login as User123 (API key included)" flow actually include an API key.

1. **After RLS is working**, insert the demo user's OpenAI API key into Supabase:
   ```sql
   INSERT INTO api_keys (user_id, provider, api_key)
   VALUES ('G6qdHk8ER0ff9e7dsjdmNDSUf8m2', 'openai', 'sk-proj-...')
   ON CONFLICT (user_id, provider) DO UPDATE SET api_key = EXCLUDED.api_key;
   ```
   (Get the actual key from `app/.env` line 1.)

2. **Verify:** Login as User123 on prod. The `loadApiKeysFromSupabase` call should succeed, and the OpenAI API key should appear in Settings > OpenAI without manual configuration.

## Success Criteria

- [ ] Login as User123 on prod produces no `PGRST301` errors in console
- [ ] `syncUserToSupabase` succeeds (user row created/updated)
- [ ] `loadApiKeysFromSupabase` returns the demo user's OpenAI key
- [ ] After login, Settings > OpenAI shows the API key pre-filled
- [ ] Sending a chat message works without manually configuring an API key

## Files Involved

| File | Change |
|------|--------|
| `app/api/auth/supabase-token.ts` | Add `.trim()` to JWT secret, add `aud` claim |
| Vercel env vars | Re-set `SUPABASE_JWT_SECRET` and `VITE_FIREBASE_API_KEY` without trailing newline |
| Supabase Dashboard | Verify/create RLS policies on `users` and `api_keys` tables |
| Supabase SQL Editor | Seed demo user API key |

## Risks

- **Vercel env var re-set requires redeploy** — brief downtime for the edge function
- **If `SUPABASE_JWT_SECRET` was the wrong key entirely** (not just trailing newline), need to get the correct one from Supabase Dashboard
- **RLS policies may need `role` claim check** — some Supabase setups require `role = 'authenticated'` in addition to `sub` matching. Our JWT already sets `role: 'authenticated'` so this should be fine.
