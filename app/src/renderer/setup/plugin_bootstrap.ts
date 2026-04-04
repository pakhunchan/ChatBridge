import { pluginController } from '@/packages/plugins/controller'
import { pluginManifests } from '@/packages/plugins/manifests'
import platform from '@/platform'

for (const manifest of pluginManifests) {
  pluginController.registerManifest(manifest)
}

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

console.info(`plugin bootstrap: registered ${pluginManifests.length} plugin(s)`)
