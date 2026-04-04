/**
 * Spotify OAuth PKCE helpers.
 * Handles code verifier/challenge generation, auth URL building,
 * token exchange, and refresh — all without a client secret.
 */

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize'
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-library-read',
  'streaming',
].join(' ')
const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? 'da3c4341184e4ec6b75b7f3871fba1d1'

// Use chatbox:// deep link in Electron, HTTPS callback in browser
const isElectron = navigator.userAgent.includes('Electron')
const REDIRECT_URI = isElectron
  ? 'chatbox://auth/spotify'
  : `${window.location.origin}/callback`

const STORAGE_KEYS = {
  accessToken: 'spotify_access_token',
  refreshToken: 'spotify_refresh_token',
  expiresAt: 'spotify_expires_at',
  codeVerifier: 'spotify_code_verifier',
} as const

// --- PKCE utilities ---

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values, (v) => possible[v % possible.length]).join('')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  return crypto.subtle.digest('SHA-256', encoder.encode(plain))
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = await sha256(verifier)
  return base64UrlEncode(hash)
}

// --- Public API ---

export function getAccessToken(): string | null {
  const expiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt)
  if (expiresAt && Date.now() >= Number(expiresAt)) {
    return null // expired
  }
  return localStorage.getItem(STORAGE_KEYS.accessToken)
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null
}

export async function buildAuthUrl(): Promise<string> {
  const verifier = generateRandomString(64)
  localStorage.setItem(STORAGE_KEYS.codeVerifier, verifier)

  const challenge = await generateCodeChallenge(verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })

  return `${AUTH_ENDPOINT}?${params.toString()}`
}

export async function exchangeCode(code: string): Promise<void> {
  const verifier = localStorage.getItem(STORAGE_KEYS.codeVerifier)
  if (!verifier) throw new Error('Missing code verifier')

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed: ${text}`)
  }

  const data = await response.json()
  storeTokens(data)
  localStorage.removeItem(STORAGE_KEYS.codeVerifier)
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)
  if (!refreshToken) return false

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) return false

  const data = await response.json()
  storeTokens(data)
  return true
}

export function clearTokens() {
  localStorage.removeItem(STORAGE_KEYS.accessToken)
  localStorage.removeItem(STORAGE_KEYS.refreshToken)
  localStorage.removeItem(STORAGE_KEYS.expiresAt)
  localStorage.removeItem(STORAGE_KEYS.codeVerifier)
}

function storeTokens(data: { access_token: string; refresh_token?: string; expires_in: number }) {
  localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token)
  if (data.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token)
  }
  const expiresAt = Date.now() + data.expires_in * 1000
  localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt))
}
