import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Start with the anon client; replaced with an authenticated client after token exchange
let supabaseInstance: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)

export function getSupabase(): SupabaseClient {
  return supabaseInstance
}

/**
 * Replace the Supabase client with one that sends the minted JWT
 * in every request, so RLS policies resolve the correct user.
 */
export function setSupabaseAccessToken(token: string): void {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
}

/**
 * Exchange a Firebase ID token for a Supabase-compatible JWT
 * by calling the serverless token exchange endpoint.
 */
export async function exchangeFirebaseToken(firebaseToken: string): Promise<string> {
  const res = await fetch('/api/auth/supabase-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firebaseToken }),
  })

  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Token exchange failed')
  }

  const { token } = await res.json()
  setSupabaseAccessToken(token)
  return token
}

// Keep backward-compatible named export
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(supabaseInstance, prop)
  },
})
