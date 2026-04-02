import { pluginController } from '@/packages/plugins/controller'
import { pluginManifests } from '@/packages/plugins/manifests'

for (const manifest of pluginManifests) {
  pluginController.registerManifest(manifest)
}

// Route incoming postMessage events from plugin iframes to the controller
window.addEventListener('message', (event: MessageEvent) => {
  pluginController.handleMessage(event)
})

console.info(`plugin bootstrap: registered ${pluginManifests.length} plugin(s)`)
