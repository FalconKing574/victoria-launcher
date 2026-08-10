// tests/java.test.ts
import { describe, it, expect } from 'vitest'
import { pickJavaPath, parseJavaMajor } from '../src/main/lib/java'

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

describe('parseJavaMajor', () => {
  it('reads a modern Temurin banner', () => {
    const output = [
      'openjdk version "17.0.19" 2026-01-20',
      'OpenJDK Runtime Environment Temurin-17.0.19+10 (build 17.0.19+10)',
      'OpenJDK 64-Bit Server VM Temurin-17.0.19+10 (build 17.0.19+10, mixed mode)'
    ].join('\n')
    expect(parseJavaMajor(output)).toBe(17)
  })

  it('reads Java 21', () => {
    expect(parseJavaMajor('openjdk version "21.0.2" 2024-01-16')).toBe(21)
  })

  // The 1.x scheme is the one that matters: a Java 8 spawns fine and only dies
  // later, inside Minecraft, with an UnsupportedClassVersionError.
  it('reads the old 1.x scheme as its second component', () => {
    expect(parseJavaMajor('java version "1.8.0_381"')).toBe(8)
  })

  it('returns null when nothing looks like a version', () => {
    expect(parseJavaMajor("'java' is not recognized as an internal command")).toBeNull()
  })

  it('returns null on empty output', () => {
    expect(parseJavaMajor('')).toBeNull()
  })
})
