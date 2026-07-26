import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'

const ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_DISCORD_CLIENT_ID',
  'VITE_DISCORD_REDIRECT_URI',
  'VITE_AZURE_CLIENT_ID'
] as const

export default defineConfig(({ mode }) => {
  // electron-vite's loadEnv reads .env but does NOT populate process.env, and the
  // main process has no other way to see that file. Inline the values instead.
  // Every key here is public-safe; the Discord client secret lives only in Supabase.
  const loaded = loadEnv(mode, process.cwd(), 'VITE_')
  const victoriaEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, loaded[key] ?? '']))

  return {
  main: {
    plugins: [externalizeDepsPlugin()],
    define: { __VICTORIA_ENV__: JSON.stringify(victoriaEnv) },
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
  }
})
