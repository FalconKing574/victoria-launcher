/** The CurseForge instance whose mods, config and saves the launcher reuses. */
export const INSTANCE_DIR =
  process.env.VICTORIA_INSTANCE_DIR ??
  'C:\\Users\\FalconKingman\\curseforge\\minecraft\\Instances\\Victoria Bien Hecho'

export const MC_VERSION = '1.20.1'
export const FORGE_VERSION = '47.4.0'
export const FORGE_INSTALLER_URL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${MC_VERSION}-${FORGE_VERSION}/forge-${MC_VERSION}-${FORGE_VERSION}-installer.jar`
