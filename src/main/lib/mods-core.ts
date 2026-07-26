import { readdirSync, existsSync, mkdirSync, renameSync, statSync } from 'fs'
import { join, basename } from 'path'

export interface ModEntry {
  filename: string
  name: string
  enabled: boolean
  sizeBytes: number
}

const ENABLED_DIR = 'mods'
const DISABLED_DIR = 'disabled_mods'

/** Turns `jei-1.20.1-15.2.0.jar` into `jei` for display. */
export function prettyModName(filename: string): string {
  const withoutExt = filename.replace(/\.jar$/i, '')
  return withoutExt.replace(/[-_]\d[\d.\-+_a-zA-Z]*$/, '')
}

function listJars(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((file) => file.toLowerCase().endsWith('.jar'))
}

export function scanMods(instanceDir: string): ModEntry[] {
  const build = (dir: string, enabled: boolean): ModEntry[] =>
    listJars(join(instanceDir, dir)).map((filename) => ({
      filename,
      name: prettyModName(filename),
      enabled,
      sizeBytes: statSync(join(instanceDir, dir, filename)).size
    }))

  return [...build(ENABLED_DIR, true), ...build(DISABLED_DIR, false)].sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}

export function toggleMod(instanceDir: string, filename: string, enable: boolean): void {
  // Never let a renderer-supplied name escape the mods folders.
  if (filename !== basename(filename) || filename.includes('..')) {
    throw new Error('Invalid mod filename')
  }

  const from = join(instanceDir, enable ? DISABLED_DIR : ENABLED_DIR, filename)
  const toDir = join(instanceDir, enable ? ENABLED_DIR : DISABLED_DIR)
  if (!existsSync(from)) throw new Error(`Mod not found: ${filename}`)
  mkdirSync(toDir, { recursive: true })
  renameSync(from, join(toDir, filename))
}
