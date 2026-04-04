import { useCallback, useEffect, useRef, useState } from 'react'
import { buildAuthUrl, getClientId, setClientId } from './auth'
import { initBridge, sendOpenUrl, sendStateUpdate } from './bridge'
import {
  getEmbedHeight,
  getState,
  onStateChange,
  setActivated,
  setAuthenticated,
  setController,
  type SpotifyState,
} from './engine'
import type { SpotifyIFrameAPI } from './spotify-types'

export default function App() {
  const [state, setState] = useState<SpotifyState>(getState())
  const [clientIdInput, setClientIdInput] = useState(getClientId() ?? '')
  const embedRef = useRef<HTMLDivElement>(null)
  const controllerInitialized = useRef(false)

  // Init bridge and subscribe to engine state changes
  useEffect(() => {
    initBridge()
    onStateChange((newState) => setState({ ...newState }))
  }, [])

  // Load Spotify iFrame API script
  useEffect(() => {
    if (!state.isAuthenticated || !state.isActivated) return
    if (controllerInitialized.current) return

    const existing = document.querySelector('script[src*="spotify.com/embed/iframe-api"]')
    if (existing) return

    const script = document.createElement('script')
    script.src = 'https://open.spotify.com/embed/iframe-api/v1'
    script.async = true
    document.body.appendChild(script)

    window.onSpotifyIframeApiReady = (api: SpotifyIFrameAPI) => {
      if (!embedRef.current || controllerInitialized.current) return
      controllerInitialized.current = true

      api.createController(
        embedRef.current,
        {
          width: '100%',
          height: getEmbedHeight(),
          theme: 'dark',
        },
        (ctrl) => {
          setController(ctrl)
          sendStateUpdate()
        },
      )
    }

    // If API already loaded (e.g., hot reload)
    if (window.SpotifyIframeApi) {
      window.onSpotifyIframeApiReady(window.SpotifyIframeApi)
    }
  }, [state.isAuthenticated, state.isActivated])

  const handleSignIn = useCallback(async () => {
    if (!clientIdInput.trim()) return
    setClientId(clientIdInput.trim())
    setAuthenticated(false) // will re-check after callback

    const url = await buildAuthUrl()
    sendOpenUrl(url)
  }, [clientIdInput])

  const handleActivate = useCallback(() => {
    setActivated()
  }, [])

  const handleOpenInSpotify = useCallback(() => {
    if (state.currentUri) {
      sendOpenUrl(
        state.currentUri.startsWith('spotify:')
          ? `https://open.spotify.com/${state.currentUri.replace(/:/g, '/').replace('spotify/', '')}`
          : state.currentUri,
      )
    }
  }, [state.currentUri])

  // --- Auth screen ---
  if (!state.isAuthenticated) {
    return (
      <div style={styles.container}>
        <div style={styles.authCard}>
          <div style={styles.spotifyLogo}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </div>
          <div style={styles.authTitle}>Connect to Spotify</div>
          <div style={styles.authSubtext}>
            Enter your Spotify app Client ID to get started.
            <br />
            <span style={styles.authNote}>
              Register at developer.spotify.com and add <code style={styles.code}>chatbox://auth/spotify</code> as a redirect URI.
            </span>
          </div>
          <input
            type="text"
            placeholder="Spotify Client ID"
            value={clientIdInput}
            onChange={(e) => setClientIdInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
            style={styles.input}
          />
          <button
            type="button"
            onClick={handleSignIn}
            disabled={!clientIdInput.trim()}
            style={{
              ...styles.authButton,
              opacity: clientIdInput.trim() ? 1 : 0.5,
            }}
          >
            Sign in with Spotify
          </button>
        </div>
      </div>
    )
  }

  // --- Activation overlay ---
  if (!state.isActivated) {
    return (
      <div style={styles.container}>
        <button type="button" onClick={handleActivate} style={styles.activateOverlay}>
          <div style={styles.activateIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="#1DB954">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div style={styles.activateText}>Click to Activate Player</div>
          <div style={styles.activateSubtext}>Required for audio playback</div>
        </button>
      </div>
    )
  }

  // --- Player UI ---
  return (
    <div style={styles.container}>
      {/* Spotify embed container */}
      <div ref={embedRef} style={{ width: '100%', maxWidth: 400 }} />

      {/* Preview mode banner */}
      <div style={styles.previewBanner}>
        Preview mode — open in Spotify for full playback
      </div>

      {/* Track info + Open in Spotify button */}
      {state.currentUri && (
        <div style={styles.trackBar}>
          <div style={styles.trackInfo}>
            <div style={styles.trackName}>{state.trackName ?? 'Loading...'}</div>
            <div style={styles.artistName}>{state.artistName ?? ''}</div>
          </div>
          <button type="button" onClick={handleOpenInSpotify} style={styles.openButton}>
            Open in Spotify
          </button>
        </div>
      )}

      {!state.currentUri && (
        <div style={styles.emptyPlayer}>
          <div style={styles.emptyText}>No track loaded</div>
          <div style={styles.emptySubtext}>Ask the AI to search for and play music!</div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#e0e0e0',
    padding: 16,
    gap: 12,
  },

  // Auth screen
  authCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    padding: 32,
    background: '#2a2a2a',
    borderRadius: 12,
    maxWidth: 380,
    width: '100%',
  },
  spotifyLogo: { marginBottom: 4 },
  authTitle: { fontSize: 20, fontWeight: 600 },
  authSubtext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  authNote: { fontSize: 12, color: '#777' },
  code: {
    background: '#333',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    background: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: 8,
    color: '#e0e0e0',
    fontSize: 14,
    outline: 'none',
  },
  authButton: {
    width: '100%',
    padding: '12px 0',
    background: '#1DB954',
    color: '#fff',
    border: 'none',
    borderRadius: 24,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },

  // Activation overlay
  activateOverlay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: 48,
    background: 'none',
    border: '2px dashed #444',
    borderRadius: 16,
    cursor: 'pointer',
    color: '#e0e0e0',
    maxWidth: 320,
    width: '100%',
  },
  activateIcon: {},
  activateText: { fontSize: 18, fontWeight: 600 },
  activateSubtext: { fontSize: 13, color: '#888' },

  // Player
  previewBanner: {
    fontSize: 11,
    color: '#999',
    background: '#222',
    padding: '4px 12px',
    borderRadius: 4,
    textAlign: 'center',
  },
  trackBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 400,
    padding: '8px 0',
    gap: 12,
  },
  trackInfo: {
    flex: 1,
    minWidth: 0,
  },
  trackName: {
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  artistName: {
    fontSize: 12,
    color: '#999',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  openButton: {
    padding: '6px 14px',
    background: '#1DB954',
    color: '#fff',
    border: 'none',
    borderRadius: 16,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  // Empty player state
  emptyPlayer: {
    textAlign: 'center',
    padding: 24,
  },
  emptyText: { fontSize: 16, fontWeight: 500, marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#888' },
}
