import { app } from 'electron'
import { join } from 'path'

/** Launcher-owned directory for libraries, assets and the Forge installer. */
export function launcherRoot(): string {
  return join(app.getPath('userData'), 'minecraft')
}

/**
 * Where the game's mods, config and saves live.
 *
 * This used to be a hardcoded path into the developer's own CurseForge install,
 * which meant every other player hit
 *   EPERM: operation not permitted, mkdir 'C:\Users\<someone else>\curseforge\...'
 * because that folder is not theirs to create. The launcher downloads the whole
 * pack itself now, so it owns the instance too — one per user, under their own
 * app data.
 *
 * VICTORIA_INSTANCE_DIR still overrides it, which is how an existing CurseForge
 * instance can be reused instead of starting fresh.
 */
export function instanceDir(): string {
  return process.env.VICTORIA_INSTANCE_DIR ?? join(app.getPath('userData'), 'instance')
}

export function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function msTokenPath(): string {
  return join(app.getPath('userData'), 'ms-token.bin')
}

/**
 * La sesión de la cuenta de Victoria (30 días), cifrada con el llavero del sistema.
 *
 * Reemplaza a `victoria-pass.bin`, que guardaba la contraseña de AuthMe: una
 * sesión se puede revocar desde el servidor y sólo sirve desde esta PC; una
 * contraseña guardada no.
 */
export function victoriaSesionPath(): string {
  return join(app.getPath('userData'), 'victoria-sesion.bin')
}

/** El archivo de contraseña del flujo viejo. Sólo para borrarlo si quedó. */
export function victoriaPasswordViejaPath(): string {
  return join(app.getPath('userData'), 'victoria-pass.bin')
}

/** Id al azar de este equipo, si el registro de Windows no se pudo leer. Ver `lib/huella.ts`. */
export function equipoIdPath(): string {
  return join(app.getPath('userData'), 'equipo.id')
}

/** Where startup failures are recorded; a packaged app has no console. */
export function crashLogPath(): string {
  return join(app.getPath('userData'), 'crash.log')
}

/** Tracks which mod jars the launcher installed, so it never deletes the player's own. */
export function syncStatePath(): string {
  return join(app.getPath('userData'), 'modpack-state.json')
}

/**
 * sha1 of each jar, keyed on its size and modification time.
 *
 * Purely a cache: deleting it costs one slow check and nothing else. It lives
 * beside the state rather than inside the instance so a wiped instance does not
 * take it down with it — the stale entries get pruned on the next scan anyway.
 */
export function hashCachePath(): string {
  return join(app.getPath('userData'), 'mod-hashes.json')
}
