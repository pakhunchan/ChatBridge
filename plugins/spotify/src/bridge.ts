/**
 * PostMessage bridge — connects the Spotify app to the ChatBridge platform.
 * Async-capable: tool handlers can return Promises (needed for search API calls).
 */
import { exchangeCode } from './auth'
import {
  getPlaybackState,
  getState,
  openInApp,
  pause,
  play,
  resume,
  search,
  setAuthenticated,
  setSize,
} from './engine'

interface ToolInvokeMessage {
  type: 'tool-invoke'
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

interface AuthCallbackMessage {
  type: 'auth-callback'
  pluginId: string
  params: { code: string }
}

type AsyncToolHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>

const toolHandlers: Record<string, AsyncToolHandler> = {
  spotify_search: (args) => search(args as Parameters<typeof search>[0]),
  spotify_play: (args) => play(args as Parameters<typeof play>[0]),
  spotify_pause: () => pause(),
  spotify_resume: () => resume(),
  spotify_get_state: () => getPlaybackState(),
  spotify_open_in_app: (args) => openInApp(args as Parameters<typeof openInApp>[0]),
  spotify_set_size: (args) => setSize(args as Parameters<typeof setSize>[0]),
}

function sendToParent(message: unknown) {
  if (window.parent !== window) {
    window.parent.postMessage(message, '*')
  }
}

async function handleToolInvoke(msg: ToolInvokeMessage) {
  const handler = toolHandlers[msg.toolName]
  if (!handler) {
    sendToParent({
      type: 'tool-error',
      toolCallId: msg.toolCallId,
      error: `Unknown tool: ${msg.toolName}`,
    })
    return
  }

  try {
    const result = await handler(msg.args)
    sendToParent({
      type: 'tool-result',
      toolCallId: msg.toolCallId,
      result,
      state: getState(),
    })
  } catch (err) {
    sendToParent({
      type: 'tool-error',
      toolCallId: msg.toolCallId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function handleAuthCallback(msg: AuthCallbackMessage) {
  try {
    await exchangeCode(msg.params.code)
    setAuthenticated(true)
    sendStateUpdate()
  } catch (err) {
    console.error('[spotify] Auth callback failed:', err)
  }
}

export function sendStateUpdate() {
  sendToParent({
    type: 'state-update',
    pluginId: 'spotify',
    state: getState(),
  })
}

export function sendOpenUrl(url: string) {
  sendToParent({ type: 'open-url', url })
}

export function initBridge() {
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data
    if (!data || typeof data !== 'object' || !data.type) return

    if (data.type === 'tool-invoke') {
      handleToolInvoke(data as ToolInvokeMessage)
    } else if (data.type === 'auth-callback' && data.pluginId === 'spotify') {
      handleAuthCallback(data as AuthCallbackMessage)
    }
  })

  // Signal to the platform that we're ready
  sendToParent({ type: 'ready', pluginId: 'spotify' })

  console.info('[spotify-plugin] Bridge initialized')
}
