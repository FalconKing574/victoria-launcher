// tests/config.test.ts
import { describe, it, expect } from 'vitest'
import { validateEnv } from '../src/main/config'

const complete = {
  VITE_SUPABASE_URL: 'https://x.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'anon',
  VITE_DISCORD_CLIENT_ID: '123',
  VITE_DISCORD_REDIRECT_URI: 'http://localhost:53682/discord/callback'
}

describe('validateEnv', () => {
  it('accepts a complete environment', () => {
    expect(validateEnv(complete)).toEqual({ ok: true, missing: [] })
  })

  it('reports every missing key', () => {
    const result = validateEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' })
    expect(result.ok).toBe(false)
    expect(result.missing).toEqual([
      'VITE_SUPABASE_ANON_KEY',
      'VITE_DISCORD_CLIENT_ID',
      'VITE_DISCORD_REDIRECT_URI'
    ])
  })

  it('treats empty strings as missing', () => {
    expect(validateEnv({ ...complete, VITE_SUPABASE_ANON_KEY: '' }).ok).toBe(false)
  })

  it('does not require the optional Azure client id', () => {
    expect(validateEnv({ ...complete, VITE_AZURE_CLIENT_ID: '' }).ok).toBe(true)
  })
})
