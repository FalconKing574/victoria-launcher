// tests/config.test.ts
import { describe, it, expect } from 'vitest'
import { validateEnv } from '../src/main/config'

const complete = {
  VITE_SUPABASE_URL: 'https://x.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon'
}

describe('validateEnv', () => {
  it('accepts a complete environment', () => {
    expect(validateEnv(complete)).toEqual({ ok: true, missing: [] })
  })

  it('reports every missing key', () => {
    const result = validateEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' })
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual(['VITE_SUPABASE_ANON_KEY'])
  })

  it('no longer requires the removed Discord keys', () => {
    // Discord OAuth was dropped: the launcher signs players in with Microsoft
    // or lets them pick a name, so those variables must not gate startup.
    expect(validateEnv(complete).missing).not.toContain('VITE_DISCORD_CLIENT_ID')
    expect(validateEnv(complete).missing).not.toContain('VITE_DISCORD_REDIRECT_URI')
  })

  it('treats empty strings as missing', () => {
    expect(validateEnv({ ...complete, VITE_SUPABASE_ANON_KEY: '' }).ok).toBe(false)
  })

  it('does not require the optional Azure client id', () => {
    expect(validateEnv({ ...complete, VITE_AZURE_CLIENT_ID: '' }).ok).toBe(true)
  })
})
