// tests/java.test.ts
import { describe, it, expect } from 'vitest'
import { pickJavaPath } from '../src/main/lib/java'

describe('pickJavaPath', () => {
  const exists = (p: string): boolean =>
    p === 'C:/curseforge/java-runtime-gamma/bin/javaw.exe' || p === 'C:/jdk/bin/javaw.exe'

  it('prefers the user override when it exists', () => {
    expect(pickJavaPath({ override: 'C:/jdk/bin/javaw.exe', candidates: [], exists })).toBe(
      'C:/jdk/bin/javaw.exe'
    )
  })

  it('ignores an override that does not exist', () => {
    const result = pickJavaPath({
      override: 'C:/missing/javaw.exe',
      candidates: ['C:/curseforge/java-runtime-gamma/bin/javaw.exe'],
      exists
    })
    expect(result).toBe('C:/curseforge/java-runtime-gamma/bin/javaw.exe')
  })

  it('returns the first existing candidate', () => {
    const result = pickJavaPath({
      override: null,
      candidates: ['C:/nope/javaw.exe', 'C:/jdk/bin/javaw.exe'],
      exists
    })
    expect(result).toBe('C:/jdk/bin/javaw.exe')
  })

  it('falls back to bare java on PATH when nothing is found', () => {
    expect(pickJavaPath({ override: null, candidates: ['C:/nope/javaw.exe'], exists })).toBe('java')
  })
})
