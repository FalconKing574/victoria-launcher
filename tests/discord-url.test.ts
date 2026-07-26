// tests/discord-url.test.ts
import { describe, it, expect } from 'vitest'
import { buildAuthorizeUrl } from '../src/main/lib/discord-url'

describe('buildAuthorizeUrl', () => {
  const url = buildAuthorizeUrl({
    clientId: '123456',
    redirectUri: 'http://localhost:53682/discord/callback',
    state: 'nonce-abc'
  })
  const parsed = new URL(url)

  it('points at the Discord authorize endpoint', () => {
    expect(parsed.origin + parsed.pathname).toBe('https://discord.com/oauth2/authorize')
  })

  it('requests only the identify scope', () => {
    expect(parsed.searchParams.get('scope')).toBe('identify')
  })

  it('uses the authorization code flow', () => {
    expect(parsed.searchParams.get('response_type')).toBe('code')
  })

  it('carries the client id, redirect uri and state', () => {
    expect(parsed.searchParams.get('client_id')).toBe('123456')
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:53682/discord/callback')
    expect(parsed.searchParams.get('state')).toBe('nonce-abc')
  })
})
