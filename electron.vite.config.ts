import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * Where the launcher fetches the modpack manifest.
 *
 * This has to be baked into the bundle: the packaged app has no .env and no
 * shell environment, so reading process.env at runtime always yielded an empty
 * string and the modpack could never be found. Override at build time with
 *   VICTORIA_MANIFEST_URL=... npm run release
 *
 * The default is the live R2 bucket, which is where the modpack actually is.
 * It used to default to a GitHub release asset that returns 404 — so anyone
 * who built without remembering the variable shipped a launcher that told
 * every player there was no modpack. A default that works removes the trap
 * instead of documenting it.
 */
const MANIFEST_URL =
  process.env.VICTORIA_MANIFEST_URL ??
  'https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: { __MANIFEST_URL__: JSON.stringify(MANIFEST_URL) },
    build: { rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts') } }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/preload')
      }
    },
    plugins: [react()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') } }
  }
})
