import { describe, it, expect } from 'vitest'
import { shouldBlockPlay } from '../src/renderer/src/lib/play-gate'

const check = (over: Partial<Parameters<typeof shouldBlockPlay>[0] & object> = {}) => ({
  needsUpdate: false,
  unavailable: false,
  toDownload: 0,
  toRemove: 0,
  installedVersion: '1.0.0',
  latestVersion: '1.0.0',
  ...over
})

describe('shouldBlockPlay', () => {
  it('blocks when the pack is behind', () => {
    expect(
      shouldBlockPlay(check({ needsUpdate: true, toDownload: 5, latestVersion: '1.1.0' }))
    ).toBe(true)
  })

  it('allows play when the pack is up to date', () => {
    expect(shouldBlockPlay(check())).toBe(false)
  })

  it('allows play when the manifest could not be reached', () => {
    // A network fault must never lock the whole playerbase out of the server.
    expect(shouldBlockPlay(check({ unavailable: true, needsUpdate: true }))).toBe(false)
  })

  it('allows play when no modpack has been published yet', () => {
    expect(
      shouldBlockPlay(check({ unavailable: true, installedVersion: null, latestVersion: null }))
    ).toBe(false)
  })

  it('allows play before the first check has returned', () => {
    expect(shouldBlockPlay(null)).toBe(false)
  })

  it('blocks when only files need removing, not just downloading', () => {
    // A mod pulled from the pack still leaves the player desynced.
    expect(shouldBlockPlay(check({ needsUpdate: true, toDownload: 0, toRemove: 2 }))).toBe(true)
  })
})
