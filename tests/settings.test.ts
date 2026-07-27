// tests/settings.test.ts
import { describe, it, expect } from 'vitest'
import {
  mergeSettings,
  DEFAULT_SETTINGS,
  jvmPerformanceArgs,
  RAM_RECOMMENDED_MB
} from '../src/main/lib/settings-core'

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

  it('never lets the minimum exceed the maximum', () => {
    // -Xms above -Xmx makes the JVM refuse to start.
    const result = mergeSettings({ maxMemoryMb: 1024, minMemoryMb: 2048 })
    expect(result.minMemoryMb).toBeLessThanOrEqual(result.maxMemoryMb)
    expect(result.minMemoryMb).toBe(1024)
  })

  it('enables the tuned JVM flags by default', () => {
    expect(mergeSettings({}).optimizedJvm).toBe(true)
  })

  it('lets the tuned JVM flags be turned off', () => {
    expect(mergeSettings({ optimizedJvm: false }).optimizedJvm).toBe(false)
  })
})

describe('jvmPerformanceArgs', () => {
  it('selects G1 and caps the pause target', () => {
    const args = jvmPerformanceArgs(RAM_RECOMMENDED_MB)
    expect(args).toContain('-XX:+UseG1GC')
    expect(args).toContain('-XX:MaxGCPauseMillis=200')
  })

  it('every argument is a JVM flag, never a bare value', () => {
    // A malformed entry here would make the JVM refuse to start with an
    // error the launcher surfaces only as an instant exit.
    for (const arg of jvmPerformanceArgs(8192)) {
      expect(arg.startsWith('-')).toBe(true)
      expect(arg).not.toContain(' ')
    }
  })

  it('scales the heap region and young gen for large heaps', () => {
    const small = jvmPerformanceArgs(8192)
    const large = jvmPerformanceArgs(16384)
    expect(small).toContain('-XX:G1HeapRegionSize=8M')
    expect(large).toContain('-XX:G1HeapRegionSize=16M')
    expect(small).toContain('-XX:G1NewSizePercent=30')
    expect(large).toContain('-XX:G1NewSizePercent=40')
  })
})
