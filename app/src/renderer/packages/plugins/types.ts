import { z } from 'zod'

// --- Plugin Tool Definition ---

export const PluginToolDefSchema = z.object({
  name: z.string().describe('Unique tool name, e.g. chess_start_game'),
  description: z.string().describe('Description shown to the LLM so it knows when to call this tool'),
  inputSchema: z.record(z.string(), z.unknown()).describe('JSON Schema object describing the tool parameters'),
})

export type PluginToolDef = z.infer<typeof PluginToolDefSchema>

// --- Plugin Manifest ---

export const PluginManifestSchema = z.object({
  id: z.string().describe('Unique plugin identifier, e.g. chess'),
  name: z.string().describe('Human-readable plugin name'),
  description: z.string().describe('What this plugin does — injected as LLM context'),
  iframeUrl: z.string().url().describe('URL of the plugin web app loaded in an iframe'),
  authType: z.enum(['none', 'api-key', 'oauth']).default('none'),
  tools: z.array(PluginToolDefSchema),
})

export type PluginManifest = z.infer<typeof PluginManifestSchema>

// --- Plugin Runtime State ---

export interface PluginState {
  pluginId: string
  lastSnapshot: Record<string, unknown> | null
}
