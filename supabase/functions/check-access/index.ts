import { createClient } from 'jsr:@supabase/supabase-js@2'
import { decideAccess, type WhitelistRow } from '../_shared/whitelist.ts'
import { offlineUuid } from '../_shared/offline-uuid.ts'
import { corsHeaders, json } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface PremiumRequest {
  mode: 'premium'
  mc_token: string
}
interface CustomRequest {
  mode: 'custom'
}
type AccessRequest = PremiumRequest | CustomRequest

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: AccessRequest
  try {
    body = await req.json()
  } catch {
    return json({ allowed: false, reason: 'bad_request' }, 400)
  }

  let uuid: string | null = null
  let username: string | null = null
  let discordId: string | null = null

  if (body.mode === 'premium') {
    // Verify the token with Mojang. A forged token fails here, so the UUID we
    // end up with is proven rather than claimed.
    const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
      headers: { Authorization: `Bearer ${body.mc_token}` }
    })
    if (!profileRes.ok) {
      return json({ allowed: false, reason: 'invalid_minecraft_token' }, 401)
    }
    const profile = (await profileRes.json()) as { id: string; name: string }
    // Mojang returns an undashed UUID; the whitelist stores the dashed form.
    uuid = dashUuid(profile.id)
    username = profile.name

    // Premium identity is the Mojang-proven UUID and nothing else. We must NOT
    // look up a launcher profile by minecraft_username to inherit its discord_id:
    // Minecraft names are mutable and launcher nicks are free text, so anyone who
    // renamed a premium account to a whitelisted player's nick would inherit that
    // player's Discord identity and pass the check. Whitelist premium players by
    // UUID (see SETUP.md).
    discordId = null
  } else {
    // Custom account: identity comes from the session, never the request body.
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await admin.auth.getUser(jwt)
    if (userError || !userData.user) {
      return json({ allowed: false, reason: 'unauthenticated' }, 401)
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('minecraft_username, discord_id')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (!profile) return json({ allowed: false, reason: 'no_profile' }, 403)
    if (!profile.discord_id) return json({ allowed: false, reason: 'discord_not_linked' }, 403)

    username = profile.minecraft_username
    uuid = offlineUuid(profile.minecraft_username)
    discordId = profile.discord_id
  }

  const { data: rows, error } = await admin
    .from('whitelist')
    .select('minecraft_uuid, discord_id, active')

  if (error) return json({ allowed: false, reason: 'server_error' }, 500)

  const decision = decideAccess((rows ?? []) as WhitelistRow[], { uuid, discordId })

  return json({
    allowed: decision.allowed,
    reason: decision.reason,
    minecraft_uuid: uuid,
    minecraft_username: username
  })
})

function dashUuid(undashed: string): string {
  if (undashed.includes('-')) return undashed
  return [
    undashed.slice(0, 8),
    undashed.slice(8, 12),
    undashed.slice(12, 16),
    undashed.slice(16, 20),
    undashed.slice(20)
  ].join('-')
}
