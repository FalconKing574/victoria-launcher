// tests/whitelist.test.ts
import { describe, it, expect } from 'vitest'
import { decideAccess, type WhitelistRow } from '../supabase/functions/_shared/whitelist'

const rows: WhitelistRow[] = [
  { minecraft_uuid: 'aaaa-1111', discord_id: null, active: true },
  { minecraft_uuid: null, discord_id: '999888777', active: true },
  { minecraft_uuid: 'bbbb-2222', discord_id: null, active: false }
]

describe('decideAccess', () => {
  it('allows when the minecraft uuid matches an active row', () => {
    expect(decideAccess(rows, { uuid: 'aaaa-1111', discordId: null }).allowed).toBe(true)
  })

  it('allows when the discord id matches an active row', () => {
    expect(decideAccess(rows, { uuid: 'unknown', discordId: '999888777' }).allowed).toBe(true)
  })

  it('denies when nothing matches', () => {
    const result = decideAccess(rows, { uuid: 'zzzz-0000', discordId: '123' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('not_whitelisted')
  })

  it('denies when the only match is an inactive row', () => {
    expect(decideAccess(rows, { uuid: 'bbbb-2222', discordId: null }).allowed).toBe(false)
  })

  it('does not treat null identity as a match against null columns', () => {
    expect(decideAccess(rows, { uuid: null, discordId: null }).allowed).toBe(false)
  })
})
