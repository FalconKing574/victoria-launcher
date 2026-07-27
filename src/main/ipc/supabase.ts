import { ipcMain } from 'electron'
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js'
import { env } from '../config'
import { linkDiscord } from './discord'

export interface LauncherProfile {
  id: string
  email: string | null
  minecraft_username: string
  discord_id: string | null
  discord_username: string | null
}

export interface AccessResult {
  allowed: boolean
  reason: string
  minecraft_uuid: string | null
  minecraft_username: string | null
}

let client: SupabaseClient | null = null

function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  }
  return client
}

let session: Session | null = null

export function currentSession(): Session | null {
  return session
}

export async function register(
  email: string,
  password: string,
  minecraftUsername: string
): Promise<LauncherProfile> {
  const trimmed = minecraftUsername.trim()
  if (!/^[A-Za-z0-9_]{3,16}$/.test(trimmed)) {
    throw new Error('El nick debe tener 3-16 caracteres: letras, números o guion bajo.')
  }

  const { data, error } = await supabase().auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  if (!data.session || !data.user) {
    throw new Error('Revisa tu correo para confirmar la cuenta y vuelve a iniciar sesión.')
  }
  session = data.session

  const { error: profileError } = await supabase()
    .from('profiles')
    .insert({ id: data.user.id, email, minecraft_username: trimmed })

  if (profileError) {
    throw new Error(
      profileError.code === '23505'
        ? 'Ese nick de Minecraft ya está en uso.'
        : profileError.message
    )
  }

  return {
    id: data.user.id,
    email,
    minecraft_username: trimmed,
    discord_id: null,
    discord_username: null
  }
}

export async function login(email: string, password: string): Promise<LauncherProfile> {
  const { data, error } = await supabase().auth.signInWithPassword({ email, password })
  if (error) throw new Error('Correo o contraseña no válidos.')
  session = data.session

  const { data: profile, error: profileError } = await supabase()
    .from('profiles')
    .select('id, email, minecraft_username, discord_id, discord_username')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) throw new Error('No se encontró el perfil de esta cuenta.')
  return profile as LauncherProfile
}

/** Opens the Discord consent flow, then asks the edge function to link it. */
/**
 * supabase-js throws for ANY non-2xx response, discarding the JSON body. Both
 * edge functions answer with a meaningful `reason` on 400/401/403/409, so
 * without this the UI only ever sees a generic failure and the specific
 * messages ("vincula Discord", "esa cuenta ya está vinculada") are unreachable.
 */
async function reasonFromError(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown }).context
  if (!(context instanceof Response)) return null
  try {
    const body = (await context.clone().json()) as { reason?: string }
    return body.reason ?? null
  } catch {
    return null
  }
}

export async function linkDiscordAccount(): Promise<LauncherProfile> {
  if (!session) throw new Error('Inicia sesión antes de vincular Discord.')

  const code = await linkDiscord()

  const { data, error } = await supabase().functions.invoke('discord-oauth', {
    body: { code },
    headers: { Authorization: `Bearer ${session.access_token}` }
  })

  const reason = error ? await reasonFromError(error) : (data as { reason?: string })?.reason
  const ok = !error && (data as { ok?: boolean })?.ok === true

  if (!ok) {
    throw new Error(
      reason === 'discord_already_linked'
        ? 'Esa cuenta de Discord ya está vinculada a otro usuario.'
        : 'No se pudo vincular Discord. Inténtalo de nuevo.'
    )
  }

  const { data: profile, error: profileError } = await supabase()
    .from('profiles')
    .select('id, email, minecraft_username, discord_id, discord_username')
    .eq('id', session.user.id)
    .single()

  // Without this check a failed re-fetch returns null typed as a profile, and
  // the renderer crashes dereferencing it.
  if (profileError || !profile) {
    throw new Error('Discord se vinculó, pero no se pudo recargar tu perfil. Vuelve a entrar.')
  }

  return profile as LauncherProfile
}

/** A denial carries a reason the UI explains; only a transport fault throws. */
async function toAccessResult(data: unknown, error: unknown): Promise<AccessResult> {
  if (!error) return data as AccessResult

  const reason = await reasonFromError(error)
  if (!reason) throw new Error('No se pudo comprobar la whitelist.')

  return { allowed: false, reason, minecraft_uuid: null, minecraft_username: null }
}

export async function checkAccessPremium(mcToken: string): Promise<AccessResult> {
  const { data, error } = await supabase().functions.invoke('check-access', {
    body: { mode: 'premium', mc_token: mcToken }
  })
  return toAccessResult(data, error)
}

export async function checkAccessCustom(): Promise<AccessResult> {
  if (!session) throw new Error('No hay sesión activa.')
  const { data, error } = await supabase().functions.invoke('check-access', {
    body: { mode: 'custom' },
    headers: { Authorization: `Bearer ${session.access_token}` }
  })
  return toAccessResult(data, error)
}

export function logout(): void {
  session = null
}

export function registerSupabaseHandlers(): void {
  ipcMain.handle('supabase:register', (_e, email: string, password: string, nick: string) =>
    register(email, password, nick)
  )
  ipcMain.handle('supabase:login', (_e, email: string, password: string) => login(email, password))
  ipcMain.handle('supabase:link-discord', () => linkDiscordAccount())
  ipcMain.handle('supabase:check-access-premium', (_e, mcToken: string) =>
    checkAccessPremium(mcToken)
  )
  ipcMain.handle('supabase:check-access-custom', () => checkAccessCustom())
  ipcMain.handle('supabase:logout', () => {
    logout()
    return true
  })
}
