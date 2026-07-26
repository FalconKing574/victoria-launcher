/**
 * Config values inlined at build time by electron.vite.config.ts.
 *
 * The main process cannot read `.env` at runtime: Vite only loads that file
 * while building, and electron-vite leaves `process.env` as a live lookup into
 * the real OS environment rather than injecting anything into it. So the four
 * required values are baked into the bundle instead. All of them are
 * public-safe by design — the Supabase anon key, the Discord client ID and its
 * redirect URI are meant to be visible to clients. The Discord client SECRET is
 * never here; only the Supabase edge function holds it.
 */
declare const __VICTORIA_ENV__: Record<string, string> | undefined

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

/**
 * The effective configuration: build-time values, overridden by any matching
 * OS environment variable. The override lets a developer point a packaged build
 * at a different Supabase project without rebuilding, and keeps `__VICTORIA_ENV__`
 * absent-but-harmless under Vitest, where `typeof` on an undeclared name is safe.
 */
export function runtimeEnv(): Record<string, string | undefined> {
  const injected = typeof __VICTORIA_ENV__ === 'undefined' ? {} : __VICTORIA_ENV__
  const resolved: Record<string, string | undefined> = { ...injected }

  for (const key of Object.keys(resolved)) {
    const fromOs = process.env[key]
    if (fromOs && fromOs.trim() !== '') resolved[key] = fromOs
  }

  return resolved
}

const source = runtimeEnv()

export const env = {
  supabaseUrl: source.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: source.VITE_SUPABASE_ANON_KEY ?? '',
  discordClientId: source.VITE_DISCORD_CLIENT_ID ?? '',
  discordRedirectUri: source.VITE_DISCORD_REDIRECT_URI ?? '',
  azureClientId: source.VITE_AZURE_CLIENT_ID ?? ''
}
