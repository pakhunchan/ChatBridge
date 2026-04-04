/**
 * PostMessage bridge — connects the flashcards app to the ChatBridge platform.
 * Listens for tool-invoke messages, routes to engine handlers, sends results back.
 */
import { createDeck, flip, getStats, listDecks, rate, study, getState } from './engine'

interface ToolInvokeMessage {
  type: 'tool-invoke'
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

type ToolHandler = (args: Record<string, unknown>) => unknown

const toolHandlers: Record<string, ToolHandler> = {
  flashcards_create_deck: (args) => createDeck(args as { name: string; cards: Array<{ front: string; back: string }> }),
  flashcards_list_decks: () => listDecks(),
  flashcards_study: (args) => study(args as { deckName: string }),
  flashcards_flip: () => flip(),
  flashcards_rate: (args) => rate(args as { rating: string }),
  flashcards_get_stats: (args) => getStats(args as { deckName?: string }),
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

/** Notify state change on user interactions (called from App.tsx) */
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
  console.info(`[flashcards-plugin] Bridge initialized, sent ready for ${pluginId}`)
}
