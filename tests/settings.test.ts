// tests/settings.test.ts
import { describe, it, expect } from 'vitest'
import { mergeSettings, DEFAULT_SETTINGS } from '../src/main/lib/settings-core'

describe('mergeSettings', () => {
  it('returns defaults for empty stored data', () => {
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps stored values over defaults', () => {
    expect(mergeSettings({ maxMemoryMb: 4096 }).maxMemoryMb).toBe(4096)
  })

  it('drops unknown keys', () => {
    expect('junk' in mergeSettings({ junk: 1 } as never)).toBe(false)
  })

  it('clamps memory to a sane range', () => {
    expect(mergeSettings({ maxMemoryMb: 100 }).maxMemoryMb).toBe(1024)
    expect(mergeSettings({ maxMemoryMb: 999999 }).maxMemoryMb).toBe(32768)
  })
})
