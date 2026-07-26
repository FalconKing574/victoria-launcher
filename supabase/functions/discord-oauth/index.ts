import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DISCORD_CLIENT_ID = Deno.env.get('DISCORD_CLIENT_ID')!
const DISCORD_CLIENT_SECRET = Deno.env.get('DISCORD_CLIENT_SECRET')!
const DISCORD_REDIRECT_URI = Deno.env.get('DISCORD_REDIRECT_URI')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Identify the caller from their session — this is the account we link to.
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData.user) {
    return json({ ok: false, reason: 'unauthenticated' }, 401)
  }

  let code: string
  try {
    const body = (await req.json()) as { code?: string }
    if (!body.code) return json({ ok: false, reason: 'missing_code' }, 400)
    code = body.code
  } catch {
    return json({ ok: false, reason: 'bad_request' }, 400)
  }

  // Exchange the code. The secret never leaves this function.
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: DISCORD_REDIRECT_URI
    })
  })

  if (!tokenRes.ok) return json({ ok: false, reason: 'discord_exchange_failed' }, 400)
  const token = (await tokenRes.json()) as { access_token: string }

  const meRes = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token.access_token}` }
  })
  if (!meRes.ok) return json({ ok: false, reason: 'discord_profile_failed' }, 400)
  const me = (await meRes.json()) as { id: string; username: string; global_name?: string }

  // Refuse to link a Discord account already bound to someone else.
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('discord_id', me.id)
    .maybeSingle()

  if (existing && existing.id !== userData.user.id) {
    return json({ ok: false, reason: 'discord_already_linked' }, 409)
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({ discord_id: me.id, discord_username: me.global_name ?? me.username })
    .eq('id', userData.user.id)

  if (updateError) return json({ ok: false, reason: 'server_error' }, 500)

  return json({ ok: true, discord_id: me.id, discord_username: me.global_name ?? me.username })
})
