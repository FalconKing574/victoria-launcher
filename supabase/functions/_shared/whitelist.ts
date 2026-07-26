export interface WhitelistRow {
  minecraft_uuid: string | null
  discord_id: string | null
  active: boolean
}

export interface Identity {
  uuid: string | null
  discordId: string | null
}

export interface AccessDecision {
  allowed: boolean
  reason: 'ok' | 'not_whitelisted'
}

/**
 * A player is allowed when an ACTIVE whitelist row matches either their
 * Minecraft UUID or their linked Discord ID. Null identity values never match,
 * so a row with a null column cannot be satisfied by an absent identity.
 */
export function decideAccess(rows: WhitelistRow[], identity: Identity): AccessDecision {
  const match = rows.some((row) => {
    if (!row.active) return false
    const uuidMatch = identity.uuid !== null && row.minecraft_uuid === identity.uuid
    const discordMatch = identity.discordId !== null && row.discord_id === identity.discordId
    return uuidMatch || discordMatch
  })

  return match ? { allowed: true, reason: 'ok' } : { allowed: false, reason: 'not_whitelisted' }
}
