export const MC_VERSION = '1.20.1'
export const FORGE_VERSION = '47.4.0'
export const FORGE_INSTALLER_URL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${MC_VERSION}-${FORGE_VERSION}/forge-${MC_VERSION}-${FORGE_VERSION}-installer.jar`

/**
 * Where the modpack manifest lives, baked in by electron.vite.config.ts.
 *
 * It cannot be read from the environment at runtime: a packaged app has no
 * .env and no shell, so process.env.VICTORIA_MANIFEST_URL was always undefined
 * and the launcher silently believed no modpack existed. An OS environment
 * variable still wins, which is what makes local testing possible.
 *
 * Any URL serving the manifest works — a GitHub release asset, an R2 bucket,
 * your own server. Publishing a new one updates every player.
 */
declare const __MANIFEST_URL__: string | undefined

export const MANIFEST_URL =
  process.env.VICTORIA_MANIFEST_URL ??
  (typeof __MANIFEST_URL__ === 'undefined' ? '' : __MANIFEST_URL__)
