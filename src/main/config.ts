import { join } from 'path'

export const REQUIRED_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_DISCORD_CLIENT_ID',
  'VITE_DISCORD_REDIRECT_URI'
] as const

export interface EnvValidation {
  ok: boolean
  missing: string[]
}

export function validateEnv(env: Record<string, string | undefined>): EnvValidation {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !env[key] || env[key]!.trim() === '')
  return { ok: missing.length === 0, missing: [...missing] }
}

/** The CurseForge instance whose mods, config and saves the launcher reuses. */
export const INSTANCE_DIR =
  process.env.VICTORIA_INSTANCE_DIR ??
  'C:\\Users\\FalconKingman\\curseforge\\minecraft\\Instances\\Victoria Bien Hecho'

export const MC_VERSION = '1.20.1'
export const FORGE_VERSION = '47.4.0'
export const FORGE_INSTALLER_URL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${MC_VERSION}-${FORGE_VERSION}/forge-${MC_VERSION}-${FORGE_VERSION}-installer.jar`

export const DISCORD_CALLBACK_PORT = 53682

export const env = {
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? '',
  discordClientId: process.env.VITE_DISCORD_CLIENT_ID ?? '',
  discordRedirectUri: process.env.VITE_DISCORD_REDIRECT_URI ?? '',
  azureClientId: process.env.VITE_AZURE_CLIENT_ID ?? ''
}
