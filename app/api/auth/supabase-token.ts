import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose'

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
)

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET?.trim()
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID?.trim()

  if (!supabaseJwtSecret || !firebaseProjectId) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { firebaseToken } = await req.json()

    if (!firebaseToken) {
      return new Response(JSON.stringify({ error: 'Missing firebaseToken' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Decode token to check issuer before verification
    const parts = firebaseToken.split('.')
    const tokenPayload = JSON.parse(atob(parts[1]))

    // Verify the Firebase ID token using Google's public keys
    const { payload } = await jwtVerify(firebaseToken, GOOGLE_JWKS, {
      issuer: `https://securetoken.google.com/${firebaseProjectId}`,
      audience: firebaseProjectId,
    }).catch((err) => {
      throw new Error(
        `${err.message} | expected iss: https://securetoken.google.com/${firebaseProjectId} | actual iss: ${tokenPayload.iss} | projectId: ${firebaseProjectId}`,
      )
    })

    const uid = payload.sub
    if (!uid) {
      return new Response(JSON.stringify({ error: 'Invalid token: no sub claim' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Mint a Supabase-compatible JWT signed with the legacy HS256 secret
    const secret = new TextEncoder().encode(supabaseJwtSecret)
    const now = Math.floor(Date.now() / 1000)

    const supabaseToken = await new SignJWT({
      sub: uid,
      role: 'authenticated',
      aud: 'authenticated',
      iss: 'supabase',
      iat: now,
      exp: now + 3600, // 1 hour
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .sign(secret)

    return new Response(JSON.stringify({ token: supabaseToken }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token exchange failed'
    return new Response(JSON.stringify({ error: message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = {
  runtime: 'edge',
}
