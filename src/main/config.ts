/** The CurseForge instance whose mods, config and saves the launcher reuses. */
export const INSTANCE_DIR =
  process.env.VICTORIA_INSTANCE_DIR ??
  'C:\\Users\\FalconKingman\\curseforge\\minecraft\\Instances\\Victoria Bien Hecho'

export const MC_VERSION = '1.20.1'
export const FORGE_VERSION = '47.4.0'
export const FORGE_INSTALLER_URL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${MC_VERSION}-${FORGE_VERSION}/forge-${MC_VERSION}-${FORGE_VERSION}-installer.jar`

/**
 * Where the modpack manifest lives. Point this at the GitHub Release asset:
 *   https://github.com/<usuario>/<repo>/releases/latest/download/manifest.json
 *
 * "latest/download" always resolves to the newest release, so publishing a new
 * release updates every player without touching the launcher.
 */
export const MANIFEST_URL = process.env.VICTORIA_MANIFEST_URL ?? ''
