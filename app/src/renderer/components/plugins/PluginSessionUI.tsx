import { useEffect, useRef } from 'react'
import { pluginController } from '@/packages/plugins/controller'

export function PluginSessionUI({ pluginId, onClose }: { pluginId: string; onClose: () => void }) {
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
    <div className="relative w-full h-full flex-1 flex flex-col">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '6px 12px',
          fontSize: 13,
          cursor: 'pointer',
          pointerEvents: 'auto',
        }}
      >
        Close
      </button>
      <iframe
        ref={iframeRef}
        src={manifest.iframeUrl}
        sandbox="allow-scripts allow-forms allow-same-origin"
        allow="encrypted-media"
        className="w-full h-full border-none flex-1"
        title={manifest.name}
      />
    </div>
  )
}
