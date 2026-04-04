/**
 * Standalone Vite config for web-only development (no Electron).
 * Mirrors the renderer config from electron.vite.config.ts.
 *
 * Usage: pnpm run dev:web
 */
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import { dvhToVh, injectBaseTag, injectReleaseDate } from './electron.vite.config'

export default defineConfig({
  root: 'src/renderer',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  plugins: [
    TanStackRouterVite({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/renderer/routes',
      generatedRouteTree: './src/renderer/routeTree.gen.ts',
    }),
    react({}),
    dvhToVh(),
    injectBaseTag(),
    injectReleaseDate(),
  ],
  server: {
    port: 1212,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://chatbridge.pakhunchan.com',
        changeOrigin: true,
      },
    },
  },
  css: {
    modules: {
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
    postcss: './postcss.config.cjs',
  },
  define: {
    'process.type': '"renderer"',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.CHATBOX_BUILD_TARGET': JSON.stringify(process.env.CHATBOX_BUILD_TARGET || 'unknown'),
    'process.env.CHATBOX_BUILD_PLATFORM': JSON.stringify('web'),
    'process.env.CHATBOX_BUILD_CHANNEL': JSON.stringify(process.env.CHATBOX_BUILD_CHANNEL || 'unknown'),
    'process.env.USE_LOCAL_API': JSON.stringify(process.env.USE_LOCAL_API || ''),
    'process.env.USE_BETA_API': JSON.stringify(process.env.USE_BETA_API || ''),
  },
  optimizeDeps: {
    include: ['mermaid'],
    esbuildOptions: {
      target: 'es2015',
    },
  },
})
