/**
 * Type declarations for the Spotify iFrame API.
 * No official @types package exists — these are derived from the Spotify docs.
 * The API is loaded via <script src="https://open.spotify.com/embed/iframe-api/v1">
 * and exposes window.onSpotifyIframeApiReady + window.SpotifyIframeApi.
 */

export interface SpotifyIFrameAPI {
  createController(
    element: HTMLElement,
    options: EmbedOptions,
    callback: (controller: EmbedController) => void,
  ): void
}

export interface EmbedOptions {
  uri?: string
  width?: string | number
  height?: string | number
  theme?: 'dark' | 'light'
}

export interface EmbedController {
  loadUri(uri: string): void
  play(): void
  togglePlay(): void
  seek(seconds: number): void
  destroy(): void
  addListener(event: 'playback_update', callback: (data: PlaybackUpdateEvent) => void): void
  addListener(event: 'ready', callback: () => void): void
}

export interface PlaybackUpdateEvent {
  data: {
    isPaused: boolean
    isBuffering: boolean
    duration: number       // milliseconds
    position: number       // milliseconds
    /** The Spotify URI currently being played (e.g. spotify:track:xxx) */
    currentUri?: string
  }
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void
    SpotifyIframeApi?: SpotifyIFrameAPI
  }
}
