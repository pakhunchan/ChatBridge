import { useEffect, useRef } from 'react'
import { pluginController } from '@/packages/plugins/controller'

export function PluginSessionUI({ pluginId }: { pluginId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const manifest = pluginController.getManifest(pluginId)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !manifest) return

    const onLoad = () => {
      if (iframe.contentWindow) {
        const origin = new URL(manifest.iframeUrl).origin
        pluginController.registerIframe(pluginId, iframe.contentWindow, origin)
      }
    }

    iframe.addEventListener('load', onLoad)
    return () => {
      iframe.removeEventListener('load', onLoad)
      pluginController.unregisterIframe(pluginId)
    }
  }, [pluginId, manifest])

  if (!manifest) return null

  return (
    <iframe
      ref={iframeRef}
      src={manifest.iframeUrl}
      sandbox="allow-scripts allow-forms allow-same-origin"
      className="w-full h-full border-none flex-1"
      title={manifest.name}
    />
  )
}
