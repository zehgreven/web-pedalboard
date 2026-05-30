import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// COOP/COEP headers required for SharedArrayBuffer (NAM WASM audio worklet).
// In Electron prod builds, these headers are injected by the main process via
// session.webRequest. In dev mode (plain browser or electron dev server), they
// are served by the Vite dev server.
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

const isElectronBuild = process.env['VITE_ELECTRON'] === 'true'

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],

  // In Electron production builds, use relative asset paths so the app
  // works when loaded via file:// protocol. For the web dev server, use '/'
  // so hot-reload and routing work correctly.
  base: isElectronBuild ? './' : '/',

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
})
