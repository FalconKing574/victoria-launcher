import { app } from 'electron'
import { join } from 'path'

/** Launcher-owned directory for libraries, assets and the Forge installer. */
export function launcherRoot(): string {
  return join(app.getPath('userData'), 'minecraft')
}

export function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function msTokenPath(): string {
  return join(app.getPath('userData'), 'ms-token.bin')
}

/** Where startup failures are recorded; a packaged app has no console. */
export function crashLogPath(): string {
  return join(app.getPath('userData'), 'crash.log')
}

/** Tracks which mod jars the launcher installed, so it never deletes the player's own. */
export function syncStatePath(): string {
  return join(app.getPath('userData'), 'modpack-state.json')
}
