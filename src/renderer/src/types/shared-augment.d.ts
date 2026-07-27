import '@shared/api'

/**
 * `optimizedJvm` exists in the main process (see `src/main/lib/settings-core.ts`,
 * where it defaults to true) and is read by the launch code, but it was never
 * added to the shared `Settings` interface. The renderer needs it to expose the
 * toggle, so it is declared here rather than by editing the preload contract.
 */
declare module '@shared/api' {
  interface Settings {
    optimizedJvm: boolean
  }
}
