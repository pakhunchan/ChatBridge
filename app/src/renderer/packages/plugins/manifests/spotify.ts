import type { PluginManifest } from '../types'

export const spotifyManifest: PluginManifest = {
  id: 'spotify',
  name: 'Spotify',
  description:
    'The user wants to listen to music. Help them search for and play songs, albums, and playlists via Spotify. Use tools to search, control playback, and open tracks in the Spotify app.',
  iframeUrl: import.meta.env.DEV ? 'http://localhost:5175' : 'https://chatbridge-spotify.pakhunchan.com',
  authType: 'oauth',
  tools: [
    {
      name: 'spotify_search',
      description:
        'Search the Spotify catalog for tracks, albums, playlists, or artists. Returns names, artists, and URIs.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (e.g. "Bohemian Rhapsody", "Chill vibes playlist").',
          },
          type: {
            type: 'string',
            enum: ['track', 'album', 'playlist', 'artist'],
            description: 'Type of result to search for. Defaults to "track".',
          },
          limit: {
            type: 'number',
            description: 'Max number of results (1-20). Defaults to 5.',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'spotify_play',
      description: 'Load a track, album, or playlist into the embedded Spotify player by URI or URL.',
      inputSchema: {
        type: 'object',
        properties: {
          uri: {
            type: 'string',
            description: 'Spotify URI (spotify:track:...) or URL (https://open.spotify.com/track/...).',
          },
        },
        required: ['uri'],
      },
    },
    {
      name: 'spotify_pause',
      description: 'Pause the embedded Spotify player.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'spotify_resume',
      description: 'Resume playback in the embedded Spotify player.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'spotify_get_state',
      description: 'Get current playback state: track name, artist, position, duration, paused status.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'spotify_open_in_app',
      description:
        'Open the current or a specified track in the native Spotify app for full playback (the embedded player only plays 30-second previews).',
      inputSchema: {
        type: 'object',
        properties: {
          uri: {
            type: 'string',
            description: 'Optional Spotify URI. If omitted, opens the currently playing track.',
          },
        },
      },
    },
    {
      name: 'spotify_set_size',
      description: 'Change the player display size: compact (80px), list (152px), or full (352px).',
      inputSchema: {
        type: 'object',
        properties: {
          size: {
            type: 'string',
            enum: ['compact', 'list', 'full'],
            description: 'Player size preset.',
          },
        },
        required: ['size'],
      },
    },
    {
      name: 'spotify_close',
      description: 'Close the Spotify player and remove it from the chat.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}
