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
interface OfflineRequest {
  mode: 'offline'
  username: string
}
type AccessRequest = PremiumRequest | OfflineRequest

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: AccessRequest
  try {
    body = await req.json()
  } catch {
    return json({ allowed: false, reason: 'bad_request' }, 400)
  }

  let uuid: string
  let username: string

  if (body.mode === 'premium') {
    // Verify the token with Mojang. A forged token fails here, so the UUID we
    // end up with is proven rather than claimed.
    const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
      headers: { Authorization: `Bearer ${body.mc_token}` }
    })

    if (profileRes.status === 401 || profileRes.status === 403) {
      return json({ allowed: false, reason: 'invalid_minecraft_token' }, 401)
    }
    if (!profileRes.ok) {
      // Mojang is down or rate limiting: not the player's fault, and telling
      // them to log in again would be wrong advice.
      return json({ allowed: false, reason: 'mojang_unavailable' }, 503)
    }

    const profile = (await profileRes.json()) as { id: string; name: string }
    uuid = dashUuid(profile.id)
    username = profile.name
  } else {
    // Offline mode has no identity proof by definition — anyone can claim any
    // name on an offline-mode server. Deriving the UUID here rather than
    // trusting a client-sent one at least guarantees it matches the name the
    // game will actually join with.
    const name = (body.username ?? '').trim()
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
      return json({ allowed: false, reason: 'invalid_username' }, 400)
    }
    username = name
    uuid = offlineUuid(name)
  }

  const { data: rows, error } = await admin
    .from('whitelist')
    .select('minecraft_uuid, discord_id, active')
    .eq('active', true)
    .eq('minecraft_uuid', uuid)

  if (error) return json({ allowed: false, reason: 'server_error' }, 500)

  const decision = decideAccess((rows ?? []) as WhitelistRow[], { uuid, discordId: null })

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
