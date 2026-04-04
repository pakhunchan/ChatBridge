/**
 * PostMessage protocol between ChatBridge (platform) and plugin iframes (app).
 * Reusable for ALL plugins — chess, weather, Spotify, etc.
 */

// --- Platform → App messages ---

/** Sent once after iframe loads to initialize the plugin with its manifest ID */
export interface InitMessage {
  type: 'init'
  pluginId: string
}

/** Sent when the LLM calls a plugin tool */
export interface ToolInvokeMessage {
  type: 'tool-invoke'
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

/** Sent when a plugin OAuth callback arrives via deep link */
export interface AuthCallbackMessage {
  type: 'auth-callback'
  pluginId: string
  params: Record<string, string>
}

export type PlatformToAppMessage = InitMessage | ToolInvokeMessage | AuthCallbackMessage

// --- App → Platform messages ---

/** Sent by the app when it's loaded and ready to receive tool invocations */
export interface ReadyMessage {
  type: 'ready'
  pluginId: string
}

/** Sent by the app after successfully handling a tool invocation */
export interface ToolResultMessage {
  type: 'tool-result'
  toolCallId: string
  result: unknown
  /** State snapshot included with every result for LLM context */
  state?: Record<string, unknown>
}

/** Sent by the app when a tool invocation fails */
export interface ToolErrorMessage {
  type: 'tool-error'
  toolCallId: string
  error: string
}

/** Sent by the app when state changes outside of tool calls (e.g., user drags a piece) */
export interface StateUpdateMessage {
  type: 'state-update'
  pluginId: string
  state: Record<string, unknown>
}

/** Sent by the app to request an iframe resize */
export interface ResizeMessage {
  type: 'resize'
  pluginId: string
  width?: number
  height: number
}

/** Sent by the app to request the host to open a URL in the system browser */
export interface OpenUrlMessage {
  type: 'open-url'
  url: string
}

export type AppToPlatformMessage =
  | ReadyMessage
  | ToolResultMessage
  | ToolErrorMessage
  | StateUpdateMessage
  | ResizeMessage
  | OpenUrlMessage
