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
export async function linkDiscordAccount(): Promise<LauncherProfile> {
  if (!session) throw new Error('Inicia sesión antes de vincular Discord.')

  const code = await linkDiscord()

  const { data, error } = await supabase().functions.invoke('discord-oauth', {
    body: { code },
    headers: { Authorization: `Bearer ${session.access_token}` }
  })

  if (error) throw new Error('No se pudo vincular Discord. Inténtalo de nuevo.')
  const result = data as { ok: boolean; reason?: string }
  if (!result.ok) {
    throw new Error(
      result.reason === 'discord_already_linked'
        ? 'Esa cuenta de Discord ya está vinculada a otro usuario.'
        : 'No se pudo vincular Discord.'
    )
  }

  const { data: profile } = await supabase()
    .from('profiles')
    .select('id, email, minecraft_username, discord_id, discord_username')
    .eq('id', session.user.id)
    .single()

  return profile as LauncherProfile
}

export async function checkAccessPremium(mcToken: string): Promise<AccessResult> {
  const { data, error } = await supabase().functions.invoke('check-access', {
    body: { mode: 'premium', mc_token: mcToken }
  })
  if (error) throw new Error('No se pudo comprobar la whitelist.')
  return data as AccessResult
}

export async function checkAccessCustom(): Promise<AccessResult> {
  if (!session) throw new Error('No hay sesión activa.')
  const { data, error } = await supabase().functions.invoke('check-access', {
    body: { mode: 'custom' },
    headers: { Authorization: `Bearer ${session.access_token}` }
  })
  if (error) throw new Error('No se pudo comprobar la whitelist.')
  return data as AccessResult
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
