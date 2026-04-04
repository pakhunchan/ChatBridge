/**
 * Spotify plugin engine — state management, Web API calls, iFrame API controller,
 * oEmbed metadata cache, and URI normalization.
 */
import { getAccessToken, isAuthenticated, refreshAccessToken } from './auth'
import type { EmbedController, PlaybackUpdateEvent } from './spotify-types'

// --- Types ---

export interface SpotifyState {
  isAuthenticated: boolean
  currentUri: string | null
  trackName: string | null
  artistName: string | null
  isPaused: boolean
  position: number       // seconds
  duration: number       // seconds
  embedSize: 'compact' | 'list' | 'full'
  isActivated: boolean   // user has clicked to satisfy autoplay policy
  summary: string
}

export type StateChangeListener = (state: SpotifyState) => void

interface OEmbedResult {
  title: string
  thumbnail_url: string
}

interface SearchResult {
  name: string
  artists: string
  uri: string
  album?: string
  duration_ms?: number
  imageUrl?: string
}

// --- Constants ---

const EMBED_HEIGHTS: Record<SpotifyState['embedSize'], number> = {
  compact: 152,
  list: 232,
  full: 352,
}

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

// --- State ---

let controller: EmbedController | null = null
let stateChangeListener: StateChangeListener | null = null
const oEmbedCache = new Map<string, OEmbedResult>()

const state: SpotifyState = {
  isAuthenticated: isAuthenticated(),
  currentUri: null,
  trackName: null,
  artistName: null,
  isPaused: true,
  position: 0,
  duration: 0,
  embedSize: 'full',
  isActivated: false,
  summary: '',
}
// Compute initial summary now that `state` is fully constructed
state.summary = buildSummary()

// --- Summary ---

function buildSummary(): string {
  if (!state.isAuthenticated) return 'Not signed in to Spotify.'
  if (!state.currentUri) return 'Signed in. No track loaded.'

  const track = state.trackName ?? 'Unknown track'
  const artist = state.artistName ?? 'Unknown artist'
  const pos = formatTime(state.position)
  const dur = formatTime(state.duration)
  const status = state.isPaused ? 'Paused' : 'Playing'
  return `${status}: ${track} by ${artist} — ${pos} / ${dur}`
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function updateSummary() {
  state.summary = buildSummary()
}

function notifyStateChange() {
  updateSummary()
  stateChangeListener?.(getState())
}

// --- URI normalization ---

export function spotifyUriToUrl(uri: string): string {
  // spotify:track:4cOdK2wGLETKBW3PvgPWqT → https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT
  if (uri.startsWith('https://')) return uri
  const parts = uri.split(':')
  if (parts.length >= 3) {
    return `https://open.spotify.com/${parts[1]}/${parts[2]}`
  }
  return uri
}

export function spotifyUrlToUri(url: string): string {
  // https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT → spotify:track:4cOdK2wGLETKBW3PvgPWqT
  if (url.startsWith('spotify:')) return url
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length >= 2) {
      return `spotify:${segments[0]}:${segments[1]}`
    }
  } catch { /* fall through */ }
  return url
}

function extractIdFromUri(uri: string): string | null {
  const normalized = uri.startsWith('https://') ? spotifyUrlToUri(uri) : uri
  const parts = normalized.split(':')
  return parts[2] ?? null
}

// --- oEmbed metadata ---

async function fetchOEmbed(uri: string): Promise<OEmbedResult | null> {
  const cached = oEmbedCache.get(uri)
  if (cached) return cached

  const url = spotifyUriToUrl(uri)
  try {
    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
    if (!response.ok) return null
    const data = await response.json()
    const result: OEmbedResult = {
      title: data.title ?? '',
      thumbnail_url: data.thumbnail_url ?? '',
    }
    oEmbedCache.set(uri, result)
    return result
  } catch {
    return null
  }
}

// Cache of track metadata from search results so we don't rely on fragile oEmbed parsing
const searchMetadataCache = new Map<string, { trackName: string; artistName: string }>()

function parseOEmbedTitle(title: string): { trackName: string; artistName: string } {
  // oEmbed title format varies:
  //   "Track Name by Artist Name"
  //   "Track Name - Album Name by Artist Name"
  // Use lastIndexOf to handle "by" in track names
  const byIndex = title.lastIndexOf(' by ')
  if (byIndex > 0) {
    return {
      trackName: title.slice(0, byIndex),
      artistName: title.slice(byIndex + 4),
    }
  }
  return { trackName: title, artistName: '' }
}

// --- Authenticated API helper ---

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  let token = getAccessToken()
  if (!token) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) throw new Error('Not authenticated. Please sign in to Spotify first.')
    token = getAccessToken()
    if (!token) throw new Error('Failed to refresh token.')
    state.isAuthenticated = true
  }

  const response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  })

  // Retry once on 401 with a refreshed token
  if (response.status === 401) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      state.isAuthenticated = false
      notifyStateChange()
      throw new Error('Session expired. Please sign in again.')
    }
    token = getAccessToken()
    state.isAuthenticated = true
    return fetch(`${SPOTIFY_API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    })
  }

  return response
}

// --- Playback update handler ---

function handlePlaybackUpdate(event: PlaybackUpdateEvent) {
  const { isPaused, position, duration, currentUri } = event.data
  state.isPaused = isPaused
  state.position = Math.round(position / 1000)
  state.duration = Math.round(duration / 1000)

  // Detect URI change → resolve metadata (prefer search cache, fallback to oEmbed)
  if (currentUri && currentUri !== state.currentUri) {
    state.currentUri = currentUri
    const cached = searchMetadataCache.get(currentUri)
    if (cached) {
      state.trackName = cached.trackName
      state.artistName = cached.artistName
      notifyStateChange()
    } else {
      fetchOEmbed(currentUri).then((result) => {
        if (result) {
          const { trackName, artistName } = parseOEmbedTitle(result.title)
          state.trackName = trackName
          state.artistName = artistName || 'Unknown artist'
        }
        notifyStateChange()
      })
    }
  } else {
    notifyStateChange()
  }
}

// --- Public API (called by bridge) ---

export function onStateChange(listener: StateChangeListener) {
  stateChangeListener = listener
}

export function getState(): SpotifyState {
  updateSummary()
  return { ...state }
}

export function getEmbedHeight(): number {
  return EMBED_HEIGHTS[state.embedSize]
}

export function setController(ctrl: EmbedController) {
  controller = ctrl
  ctrl.addListener('playback_update', handlePlaybackUpdate)
  ctrl.addListener('ready', () => {
    console.info('[spotify] Embed controller ready')
  })
}

export function setActivated() {
  state.isActivated = true
  notifyStateChange()
}

export function setAuthenticated(value: boolean) {
  state.isAuthenticated = value
  notifyStateChange()
}

// --- Tool handlers ---

export async function search(args: {
  query: string
  type?: 'track' | 'album' | 'playlist' | 'artist'
  limit?: number
}): Promise<{ results: SearchResult[]; message: string }> {
  const type = args.type ?? 'track'
  const limit = Math.min(args.limit ?? 5, 20)

  const params = new URLSearchParams({
    q: args.query,
    type,
    limit: String(limit),
  })

  const response = await apiFetch(`/search?${params.toString()}`)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Spotify search failed: ${text}`)
  }

  const data = await response.json()
  const results: SearchResult[] = []

  const items = data[`${type}s`]?.items ?? []
  for (const item of items) {
    // Pick the smallest album art image (typically 64px) for thumbnail use
    const images = item.album?.images ?? item.images ?? []
    const thumbnail = images.length > 0 ? images[images.length - 1].url : undefined

    results.push({
      name: item.name,
      artists: item.artists?.map((a: { name: string }) => a.name).join(', ') ?? item.owner?.display_name ?? '',
      uri: item.uri,
      album: item.album?.name,
      duration_ms: item.duration_ms,
      imageUrl: thumbnail,
    })
  }

  // Cache search metadata so play() can use accurate artist names
  for (const r of results) {
    searchMetadataCache.set(r.uri, { trackName: r.name, artistName: r.artists })
  }

  return {
    results,
    message: results.length > 0
      ? `Found ${results.length} ${type}(s) for "${args.query}".`
      : `No ${type}s found for "${args.query}".`,
  }
}

export function play(args: { uri: string }) {
  if (!controller) throw new Error('Player not initialized. Wait for the embed to load.')
  const uri = args.uri.startsWith('https://') ? spotifyUrlToUri(args.uri) : args.uri
  state.currentUri = uri
  controller.loadUri(uri)

  // Resolve metadata — prefer search cache for accurate artist names
  const cached = searchMetadataCache.get(uri)
  if (cached) {
    state.trackName = cached.trackName
    state.artistName = cached.artistName
    notifyStateChange()
  } else {
    fetchOEmbed(uri).then((result) => {
      if (result) {
        const { trackName, artistName } = parseOEmbedTitle(result.title)
        state.trackName = trackName
        state.artistName = artistName || 'Unknown artist'
        notifyStateChange()
      }
    })
  }

  return { success: true, message: `Loading ${uri} in player.` }
}

export function pause() {
  if (!controller) throw new Error('Player not initialized.')
  // togglePlay acts as pause when playing
  if (!state.isPaused) {
    controller.togglePlay()
  }
  return { success: true, message: 'Paused.' }
}

export function resume() {
  if (!controller) throw new Error('Player not initialized.')
  if (state.isPaused) {
    controller.togglePlay()
  }
  return { success: true, message: 'Resumed.' }
}

export function getPlaybackState() {
  return {
    currentUri: state.currentUri,
    trackName: state.trackName,
    artistName: state.artistName,
    isPaused: state.isPaused,
    position: state.position,
    duration: state.duration,
    embedSize: state.embedSize,
    isAuthenticated: state.isAuthenticated,
  }
}

export function openInApp(args: { uri?: string }): { success: boolean; message: string; deepLink: string } {
  const uri = args.uri ?? state.currentUri
  if (!uri) throw new Error('No track loaded. Play something first or provide a URI.')

  const id = extractIdFromUri(uri)
  const normalized = uri.startsWith('https://') ? spotifyUrlToUri(uri) : uri
  const type = normalized.split(':')[1] ?? 'track'
  const deepLink = id ? `spotify://${type}/${id}` : `spotify://search/${encodeURIComponent(uri)}`

  // Request host to open the deep link
  sendToParent({ type: 'open-url', url: deepLink })

  return {
    success: true,
    message: `Opening in Spotify app.`,
    deepLink,
  }
}

export function setSize(args: { size: 'compact' | 'list' | 'full' }) {
  state.embedSize = args.size
  const height = EMBED_HEIGHTS[args.size]

  sendToParent({
    type: 'resize',
    pluginId: 'spotify',
    height,
  })

  notifyStateChange()
  return { success: true, message: `Player size set to ${args.size} (${height}px).` }
}

// --- PostMessage to parent ---

function sendToParent(message: unknown) {
  if (window.parent !== window) {
    window.parent.postMessage(message, '*')
  }
}
