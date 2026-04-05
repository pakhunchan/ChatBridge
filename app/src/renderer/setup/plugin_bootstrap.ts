import { pluginController } from '@/packages/plugins/controller'
import { pluginManifests } from '@/packages/plugins/manifests'
import type { PluginManifest } from '@/packages/plugins/types'
import { PluginManifestSchema } from '@/packages/plugins/types'
import platform from '@/platform'

// Register hardcoded manifests immediately (no network dependency)
for (const manifest of pluginManifests) {
  pluginController.registerManifest(manifest)
}

console.info(`plugin bootstrap: registered ${pluginManifests.length} hardcoded plugin(s)`)

// Fetch approved plugins from API and register any new third-party plugins
fetchApprovedPlugins()
  .then((remotePlugins) => {
    let registered = 0
    for (const plugin of remotePlugins) {
      if (pluginController.getManifest(plugin.id)) continue // hardcoded takes precedence
      pluginController.registerManifest(plugin)
      registered++
    }
    if (registered > 0) {
      console.info(`plugin bootstrap: registered ${registered} remote plugin(s)`)
    }
  })
  .catch((err) => {
    console.warn('plugin bootstrap: failed to fetch remote plugins, using hardcoded only', err)
  })

// Route incoming postMessage events from plugin iframes to the controller
window.addEventListener('message', (event: MessageEvent) => {
  pluginController.handleMessage(event)
})

// Wire up open-url handler so plugins can open URLs in the system browser
pluginController.onOpenUrl((url: string) => {
  platform.openLink(url)
})

// Listen for auth callbacks from main process (deep link redirects)
if (platform.onNavigate) {
  platform.onNavigate((path: string) => {
    // Match paths like /auth/spotify?code=xxx routed from chatbox://auth/spotify
    const match = path.match(/^\/auth\/(\w+)\?(.+)$/)
    if (match) {
      const pluginId = match[1] ?? ''
      const params: Record<string, string> = {}
      for (const [key, value] of new URLSearchParams(match[2])) {
        params[key] = value
      }
      pluginController.forwardAuthCallback(pluginId, params)
    }
  })
}

async function fetchApprovedPlugins(): Promise<PluginManifest[]> {
  const res = await fetch('/api/plugins/approved')
  if (!res.ok) return []
  const { plugins } = await res.json()
  if (!Array.isArray(plugins)) return []

  const valid: PluginManifest[] = []
  for (const p of plugins) {
    const result = PluginManifestSchema.safeParse(p)
    if (result.success) {
      valid.push(result.data)
    } else {
      console.warn(`plugin bootstrap: skipping invalid remote plugin '${p.id}':`, result.error.message)
    }
  }
  return valid
}
