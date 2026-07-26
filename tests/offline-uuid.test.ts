// tests/offline-uuid.test.ts
import { describe, it, expect } from 'vitest'
import { offlineUuid } from '../supabase/functions/_shared/offline-uuid'

describe('offlineUuid', () => {
  it('matches Minecraft offline UUIDs for known names', () => {
    expect(offlineUuid('Notch')).toBe('b50ad385-829d-3141-a216-7e7d7539ba7f')
    expect(offlineUuid('Player')).toBe('a01e3843-e521-3998-958a-f459800e4d11')
    expect(offlineUuid('Victoria')).toBe('e4b15e84-ce04-3257-b401-4dd387ff8aac')
  })

  it('is deterministic', () => {
    expect(offlineUuid('FalconKingman')).toBe(offlineUuid('FalconKingman'))
  })

  it('is case sensitive, matching vanilla behaviour', () => {
    expect(offlineUuid('Notch')).not.toBe(offlineUuid('notch'))
  })

  it('sets the UUID version to 3 and the IETF variant', () => {
    const uuid = offlineUuid('AnyName')
    expect(uuid[14]).toBe('3')
    expect(['8', '9', 'a', 'b']).toContain(uuid[19])
  })
})
