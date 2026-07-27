import { ipcMain } from 'electron'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config'

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

/**
 * supabase-js throws for ANY non-2xx response, discarding the JSON body. The
 * edge function answers with a meaningful `reason` on 400/401/503, so without
 * this the UI would only ever see a generic failure.
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

export async function checkAccessOffline(username: string): Promise<AccessResult> {
  const { data, error } = await supabase().functions.invoke('check-access', {
    body: { mode: 'offline', username }
  })
  return toAccessResult(data, error)
}

export function registerSupabaseHandlers(): void {
  ipcMain.handle('supabase:check-access-premium', (_e, mcToken: string) =>
    checkAccessPremium(mcToken)
  )
  ipcMain.handle('supabase:check-access-offline', (_e, username: string) =>
    checkAccessOffline(username)
  )
}
