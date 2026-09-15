import { readFileSync, existsSync } from 'fs'
import { settingsPath } from './paths'
import { mergeSettings, DEFAULT_SETTINGS, type Settings } from './settings-core'
import { writeJsonAtomic } from './write-atomic'

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
  // Atomico por el mismo motivo que modpack-state.json: una escritura cortada a
  // la mitad deja un archivo que no parsea. loadSettings cae a los valores por
  // defecto y el launcher abre igual, pero el jugador pierde en silencio su
  // memoria asignada, su ruta de Java y su eleccion de musica -- y el launcher
  // que se los borro parece no haber hecho nada.
  writeJsonAtomic(settingsPath(), next)
  return next
}
