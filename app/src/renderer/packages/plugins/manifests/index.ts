import type { PluginManifest } from '../types'
import { chessManifest } from './chess'
import { flashcardsManifest } from './flashcards'

export const pluginManifests: PluginManifest[] = [chessManifest, flashcardsManifest]
