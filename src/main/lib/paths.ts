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
 * La contrasenia de Victoria, cifrada con el llavero del sistema.
 *
 * Es la de AuthMe: la misma que el jugador escribia con `/login` adentro del
 * juego. Se guarda para no volver a pedirsela, igual que el token de Microsoft
 * y con el mismo `safeStorage`. Si el llavero no esta disponible, no se guarda
 * nada y se le pide cada vez -- que es molesto pero no inseguro.
 */
export function victoriaPasswordPath(): string {
  return join(app.getPath('userData'), 'victoria-pass.bin')
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
