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
