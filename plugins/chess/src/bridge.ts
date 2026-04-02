/**
 * PostMessage bridge — connects the chess app to the ChatBridge platform.
 * Listens for tool-invoke messages, routes to engine handlers, sends results back.
 */
import { getBoard, getMoves, makeMove, resign, startGame, getState } from './engine'

interface ToolInvokeMessage {
  type: 'tool-invoke'
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

type ToolHandler = (args: Record<string, unknown>) => unknown

const toolHandlers: Record<string, ToolHandler> = {
  chess_start_game: (args) => startGame(args as { playerColor?: string }),
  chess_get_board: () => getBoard(),
  chess_make_move: (args) => makeMove(args as { move: string }),
  chess_get_moves: (args) => getMoves(args as { square?: string }),
  chess_resign: () => resign(),
}

function sendToParent(message: unknown) {
  if (window.parent !== window) {
    window.parent.postMessage(message, '*')
  }
}

function handleToolInvoke(msg: ToolInvokeMessage) {
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
    const result = handler(msg.args)
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

/** Notify state change on user moves (called from App.tsx after drag-drop) */
export function sendStateUpdate(pluginId: string) {
  sendToParent({
    type: 'state-update',
    pluginId,
    state: getState(),
  })
}

export function initBridge(pluginId: string) {
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data
    if (!data || typeof data !== 'object' || !data.type) return

    if (data.type === 'tool-invoke') {
      handleToolInvoke(data as ToolInvokeMessage)
    }
  })

  // Signal to the platform that we're ready
  sendToParent({ type: 'ready', pluginId })
  console.info(`[chess-plugin] Bridge initialized, sent ready for ${pluginId}`)
}
