import type { PluginManifest } from '../types'
import { chessManifest } from './chess'
import { flashcardsManifest } from './flashcards'
import { spotifyManifest } from './spotify'

export const pluginManifests: PluginManifest[] = [chessManifest, flashcardsManifest, spotifyManifest]
