import { jsonSchema, tool } from 'ai'
import type { ToolSet } from 'ai'
import type { PluginManifest, PluginState } from './types'

// Mock responses for Step 1 — replaced by real postMessage execution in Step 3
const MOCK_RESPONSES: Record<string, (args: Record<string, unknown>) => unknown> = {
  chess_start_game: (args) => ({
    success: true,
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'white',
    playerColor: args.playerColor ?? 'white',
    message: 'Game started! White to move.',
  }),
  chess_get_board: () => ({
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    turn: 'black',
    moveNumber: 1,
    inCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
    isGameOver: false,
  }),
  chess_make_move: (args) => ({
    success: true,
    move: args.move,
    fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    turn: 'black',
    inCheck: false,
    isCheckmate: false,
    isGameOver: false,
    message: `Move ${args.move} played.`,
  }),
  chess_get_moves: (args) => ({
    square: args.square ?? null,
    moves: args.square ? ['e3', 'e4'] : ['a3', 'a4', 'b3', 'b4', 'c3', 'c4', 'd3', 'd4', 'e3', 'e4', 'f3', 'f4', 'g3', 'g4', 'h3', 'h4', 'Na3', 'Nc3', 'Nf3', 'Nh3'],
  }),
  chess_resign: () => ({
    success: true,
    message: 'Game resigned.',
    isGameOver: true,
  }),
}

class PluginController {
  private manifests = new Map<string, PluginManifest>()
  private toolToPlugin = new Map<string, string>()
  private pluginStates = new Map<string, PluginState>()

  registerManifest(manifest: PluginManifest) {
    this.manifests.set(manifest.id, manifest)
    for (const toolDef of manifest.tools) {
      this.toolToPlugin.set(toolDef.name, manifest.id)
    }
    this.pluginStates.set(manifest.id, {
      pluginId: manifest.id,
      lastSnapshot: null,
    })
  }

  isPluginTool(toolName: string): boolean {
    return this.toolToPlugin.has(toolName)
  }

  getManifestForTool(toolName: string): PluginManifest | undefined {
    const pluginId = this.toolToPlugin.get(toolName)
    if (!pluginId) return undefined
    return this.manifests.get(pluginId)
  }

  getAvailableTools(): ToolSet {
    const toolSet: ToolSet = {}
    for (const manifest of this.manifests.values()) {
      for (const toolDef of manifest.tools) {
        toolSet[toolDef.name] = tool({
          description: toolDef.description,
          inputSchema: jsonSchema(toolDef.inputSchema),
          execute: async (args: Record<string, unknown>) => {
            // Step 1: mock execution — Step 3 replaces with postMessage
            const mockFn = MOCK_RESPONSES[toolDef.name]
            if (mockFn) {
              const result = mockFn(args)
              // Store snapshot for LLM context injection
              const state = this.pluginStates.get(manifest.id)
              if (state && typeof result === 'object' && result !== null) {
                state.lastSnapshot = result as Record<string, unknown>
              }
              return result
            }
            return { error: `No handler for tool ${toolDef.name}` }
          },
        })
      }
    }
    return toolSet
  }

  getActivePluginContext(): string {
    const lines: string[] = []
    for (const state of this.pluginStates.values()) {
      if (!state.lastSnapshot) continue
      const manifest = this.manifests.get(state.pluginId)
      if (!manifest) continue
      const snapshot = state.lastSnapshot
      const parts: string[] = []
      if (snapshot.fen) parts.push(`FEN: ${snapshot.fen}`)
      if (snapshot.turn) parts.push(`Turn: ${snapshot.turn}`)
      if (snapshot.isGameOver) parts.push('Game Over')
      if (snapshot.inCheck) parts.push('In Check')
      if (parts.length > 0) {
        lines.push(`- ${manifest.name}: ${parts.join(', ')}`)
      }
    }
    if (lines.length === 0) return ''
    return `\nActive plugins:\n${lines.join('\n')}`
  }
}

export const pluginController = new PluginController()
