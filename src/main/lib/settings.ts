import { readFileSync, writeFileSync, existsSync } from 'fs'
import { settingsPath } from './paths'
import { mergeSettings, DEFAULT_SETTINGS, type Settings } from './settings-core'

export { DEFAULT_SETTINGS, mergeSettings }
export type { Settings }

export function loadSettings(): Settings {
  if (!existsSync(settingsPath())) return DEFAULT_SETTINGS
  try {
    return mergeSettings(JSON.parse(readFileSync(settingsPath(), 'utf8')))
  } catch {
    // A corrupt settings file should never stop the launcher from opening.
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = mergeSettings({ ...loadSettings(), ...patch })
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
