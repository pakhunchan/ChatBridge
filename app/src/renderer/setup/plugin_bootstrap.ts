import { pluginController } from '@/packages/plugins/controller'
import { pluginManifests } from '@/packages/plugins/manifests'

for (const manifest of pluginManifests) {
  pluginController.registerManifest(manifest)
}

console.info(`plugin bootstrap: registered ${pluginManifests.length} plugin(s)`)
