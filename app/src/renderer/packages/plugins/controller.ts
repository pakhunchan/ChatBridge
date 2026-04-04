import type { ToolSet } from 'ai'
import { jsonSchema, tool } from 'ai'
import type { AuthCallbackMessage, PlatformToAppMessage } from './protocol'
import type { PluginManifest, PluginState } from './types'

interface PendingCall {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  timer: ReturnType<typeof setTimeout>
  pluginId: string
}

interface IframeSession {
  window: Window
  origin: string
  ready: boolean
}

interface QueuedInvocation {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

const TOOL_TIMEOUT_MS = 30_000

export type StateUpdateListener = (pluginId: string, state: Record<string, unknown>) => void
export type PluginChangeListener = () => void

class PluginController {
  private manifests = new Map<string, PluginManifest>()
  private toolToPlugin = new Map<string, string>()
  private pluginStates = new Map<string, PluginState>()
  private pendingCalls = new Map<string, PendingCall>()
  private iframeSessions = new Map<string, IframeSession>()
  private invocationQueue = new Map<string, QueuedInvocation[]>()
  private stateUpdateListeners = new Set<StateUpdateListener>()
  private resizeListeners = new Set<(pluginId: string, height: number) => void>()
  private changeListeners = new Set<PluginChangeListener>()
  private activePlugins = new Set<string>()
  private earlyReadyPlugins = new Set<string>()

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

  getManifest(pluginId: string): PluginManifest | undefined {
    return this.manifests.get(pluginId)
  }

  // --- State update listeners ---

  onStateUpdate(listener: StateUpdateListener): () => void {
    this.stateUpdateListeners.add(listener)
    return () => this.stateUpdateListeners.delete(listener)
  }

  onResize(listener: (pluginId: string, height: number) => void): () => void {
    this.resizeListeners.add(listener)
    return () => this.resizeListeners.delete(listener)
  }

  onChange(listener: PluginChangeListener): () => void {
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }

  private notifyChange() {
    for (const listener of this.changeListeners) {
      listener()
    }
  }

  // --- Iframe lifecycle ---

  registerIframe(pluginId: string, iframeWindow: Window, origin: string) {
    // If the iframe already sent 'ready' before the load event fired,
    // mark the session as ready immediately and flush queued invocations.
    const alreadyReady = this.earlyReadyPlugins.has(pluginId)
    this.earlyReadyPlugins.delete(pluginId)
    this.iframeSessions.set(pluginId, { window: iframeWindow, origin, ready: alreadyReady })
    // Send init message — use '*' because sandboxed iframes (without allow-same-origin)
    // have a null origin, so targeted postMessage would be silently dropped.
    const initMsg: PlatformToAppMessage = { type: 'init', pluginId }
    iframeWindow.postMessage(initMsg, '*')
    if (alreadyReady) {
      this.onIframeReady(pluginId)
    }
  }

  unregisterIframe(pluginId: string) {
    this.iframeSessions.delete(pluginId)
    // Reject any pending calls for this plugin
    for (const [callId, pending] of this.pendingCalls) {
      if (pending.pluginId === pluginId) {
        clearTimeout(pending.timer)
        pending.reject(new Error(`Plugin ${pluginId} iframe unmounted`))
        this.pendingCalls.delete(callId)
      }
    }
    // Clear queue
    this.invocationQueue.delete(pluginId)
  }

  onIframeReady(pluginId: string) {
    const session = this.iframeSessions.get(pluginId)
    if (!session) {
      // The iframe's React app sent 'ready' before the parent's load event fired.
      // Stash it so registerIframe() can pick it up.
      this.earlyReadyPlugins.add(pluginId)
      return
    }
    session.ready = true
    // Flush queued invocations
    const queued = this.invocationQueue.get(pluginId)
    if (queued) {
      for (const invocation of queued) {
        this.dispatchToIframe(pluginId, invocation)
      }
      this.invocationQueue.delete(pluginId)
    }
  }

  private dispatchToIframe(pluginId: string, invocation: QueuedInvocation) {
    const session = this.iframeSessions.get(pluginId)
    if (!session) {
      console.warn(`[plugin] No iframe session for ${pluginId}, cannot dispatch ${invocation.toolName}`)
      return
    }
    const msg: PlatformToAppMessage = {
      type: 'tool-invoke',
      toolCallId: invocation.toolCallId,
      toolName: invocation.toolName,
      args: invocation.args,
    }
    console.info(`[plugin] Dispatching ${invocation.toolName} (${invocation.toolCallId}) to ${pluginId}`)
    session.window.postMessage(msg, '*')
  }

  // --- Message handling ---

  handleMessage(event: MessageEvent) {
    const data = event.data
    if (!data || typeof data.type !== 'string') return

    switch (data.type) {
      case 'ready': {
        if (typeof data.pluginId === 'string') {
          this.onIframeReady(data.pluginId)
        }
        break
      }
      case 'tool-result': {
        console.info(`[plugin] Received tool-result for ${data.toolCallId}`)
        const pending = this.pendingCalls.get(data.toolCallId)
        if (!pending) {
          console.warn(`[plugin] No pending call for ${data.toolCallId} — already resolved or timed out`)
          break
        }
        clearTimeout(pending.timer)
        this.pendingCalls.delete(data.toolCallId)
        // Update plugin state snapshot
        if (data.state && typeof data.state === 'object') {
          const state = this.pluginStates.get(pending.pluginId)
          if (state) {
            state.lastSnapshot = data.state as Record<string, unknown>
          }
        }
        pending.resolve(data.result)
        break
      }
      case 'tool-error': {
        console.warn(`[plugin] Received tool-error for ${data.toolCallId}: ${data.error}`)
        const pending = this.pendingCalls.get(data.toolCallId)
        if (!pending) break
        clearTimeout(pending.timer)
        this.pendingCalls.delete(data.toolCallId)
        pending.reject(new Error(data.error ?? 'Plugin tool error'))
        break
      }
      case 'state-update': {
        if (typeof data.pluginId === 'string' && data.state && typeof data.state === 'object') {
          const stateRecord = data.state as Record<string, unknown>
          const state = this.pluginStates.get(data.pluginId)
          if (state) {
            state.lastSnapshot = stateRecord
          }
          for (const listener of this.stateUpdateListeners) {
            listener(data.pluginId, stateRecord)
          }
        }
        break
      }
      case 'resize': {
        if (typeof data.pluginId === 'string' && typeof data.height === 'number') {
          for (const listener of this.resizeListeners) {
            listener(data.pluginId, data.height)
          }
        }
        break
      }
      case 'open-url': {
        if (typeof data.url === 'string') {
          this.openUrlHandler?.(data.url)
        }
        break
      }
    }
  }

  // --- Open URL handler (set by platform integration) ---

  private openUrlHandler: ((url: string) => void) | null = null

  onOpenUrl(handler: (url: string) => void) {
    this.openUrlHandler = handler
  }

  // --- Auth callback forwarding ---

  forwardAuthCallback(pluginId: string, params: Record<string, string>) {
    const session = this.iframeSessions.get(pluginId)
    if (!session) {
      console.warn(`[plugin] No iframe session for ${pluginId}, cannot forward auth callback`)
      return
    }
    const msg: AuthCallbackMessage = {
      type: 'auth-callback',
      pluginId,
      params,
    }
    session.window.postMessage(msg, '*')
  }

  // --- Tool execution ---

  getAvailableTools(): ToolSet {
    const toolSet: ToolSet = {}
    for (const manifest of this.manifests.values()) {
      for (const toolDef of manifest.tools) {
        toolSet[toolDef.name] = tool({
          description: toolDef.description,
          inputSchema: jsonSchema(toolDef.inputSchema),
          execute: async (args: Record<string, unknown>) => {
            const pluginId = manifest.id

            // Handle close tool directly — no iframe needed
            if (toolDef.name === `${manifest.id}_close`) {
              this.deactivatePlugin(pluginId)
              return { success: true, message: `${manifest.name} closed.` }
            }

            // Re-activate plugin if it was closed
            this.activatePlugin(pluginId)
            const toolCallId = `${toolDef.name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

            return await new Promise((resolve, reject) => {
              const timer = setTimeout(() => {
                this.pendingCalls.delete(toolCallId)
                reject(new Error(`Tool ${toolDef.name} timed out after ${TOOL_TIMEOUT_MS}ms`))
              }, TOOL_TIMEOUT_MS)

              this.pendingCalls.set(toolCallId, { resolve, reject, timer, pluginId })

              const invocation: QueuedInvocation = {
                toolCallId,
                toolName: toolDef.name,
                args,
              }

              const session = this.iframeSessions.get(pluginId)
              if (session?.ready) {
                this.dispatchToIframe(pluginId, invocation)
              } else {
                // Queue for when iframe becomes ready
                const queue = this.invocationQueue.get(pluginId) ?? []
                queue.push(invocation)
                this.invocationQueue.set(pluginId, queue)
              }
            })
          },
        })
      }
    }
    return toolSet
  }

  // --- Plugin context for LLM ---

  getActivePluginContext(): string {
    const lines: string[] = []
    for (const state of this.pluginStates.values()) {
      if (!state.lastSnapshot) continue
      const manifest = this.manifests.get(state.pluginId)
      if (!manifest) continue
      const summary = state.lastSnapshot.summary
      if (typeof summary === 'string' && summary.length > 0) {
        lines.push(`- ${manifest.name}: ${summary}`)
      }
    }
    if (lines.length === 0) return ''
    return `\nActive plugins:\n${lines.join('\n')}`
  }

  // --- Active plugin tracking ---

  activatePlugin(pluginId: string) {
    const wasActive = this.activePlugins.has(pluginId)
    this.activePlugins.add(pluginId)
    if (!wasActive) this.notifyChange()
  }

  deactivatePlugin(pluginId: string) {
    this.activePlugins.delete(pluginId)
    this.notifyChange()
    this.unregisterIframe(pluginId)
    const state = this.pluginStates.get(pluginId)
    if (state) {
      state.lastSnapshot = null
    }
  }

  getActivePluginIds(): string[] {
    return [...this.activePlugins]
  }
}

export const pluginController = new PluginController()
