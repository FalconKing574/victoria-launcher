import { describe, it, expect } from 'vitest'
import { isFresh, pruneCache, parseCache, type HashCache } from '../src/main/lib/hash-cache'

const entry = (sha1: string, size = 100, mtimeMs = 1000): HashCache[string] => ({
  size,
  mtimeMs,
  sha1
})

const SHA = 'a'.repeat(40)

describe('isFresh', () => {
  it('trusts an entry whose size and mtime both still match', () => {
    expect(isFresh(entry(SHA, 100, 1000), { size: 100, mtimeMs: 1000 })).toBe(true)
  })

  it('rejects a missing entry', () => {
    expect(isFresh(undefined, { size: 100, mtimeMs: 1000 })).toBe(false)
  })

  it('rejects a file that was rewritten at the same length', () => {
    expect(isFresh(entry(SHA, 100, 1000), { size: 100, mtimeMs: 2000 })).toBe(false)
  })

  it('rejects a file that changed size', () => {
    expect(isFresh(entry(SHA, 100, 1000), { size: 101, mtimeMs: 1000 })).toBe(false)
  })
})

describe('pruneCache', () => {
  it('drops entries for jars that are no longer in the folder', () => {
    const cache = { 'jei.jar': entry(SHA), 'gone.jar': entry('b'.repeat(40)) }
    expect(Object.keys(pruneCache(cache, ['jei.jar']))).toEqual(['jei.jar'])
  })

  it('keeps everything when nothing was removed', () => {
    const cache = { 'jei.jar': entry(SHA), 'embeddium.jar': entry('b'.repeat(40)) }
    expect(pruneCache(cache, ['jei.jar', 'embeddium.jar'])).toEqual(cache)
  })

  it('returns an empty cache for an empty folder', () => {
    expect(pruneCache({ 'jei.jar': entry(SHA) }, [])).toEqual({})
  })
})

describe('parseCache', () => {
  it('reads a well-formed cache back', () => {
    const cache = { 'jei.jar': entry(SHA) }
    expect(parseCache(JSON.parse(JSON.stringify(cache)))).toEqual(cache)
  })

  it.each([null, undefined, 42, 'nope', []])('ignores %p instead of throwing', (raw) => {
    expect(parseCache(raw)).toEqual({})
  })

  it('drops an entry whose hash is not a full sha1', () => {
    // A truncated hash would let the launcher skip a download it never verified.
    expect(parseCache({ 'jei.jar': { size: 1, mtimeMs: 1, sha1: 'abc' } })).toEqual({})
  })

  it('drops an entry with a missing stamp', () => {
    expect(parseCache({ 'jei.jar': { sha1: SHA } })).toEqual({})
  })

  it('keeps the good entries and drops only the bad ones', () => {
    const parsed = parseCache({
      'jei.jar': entry(SHA),
      'broken.jar': { size: 'big', mtimeMs: 1, sha1: SHA }
    })
    expect(Object.keys(parsed)).toEqual(['jei.jar'])
  })
})
