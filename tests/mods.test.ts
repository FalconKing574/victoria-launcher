// tests/mods.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { scanMods, toggleMod, prettyModName } from '../src/main/lib/mods-core'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'victoria-mods-'))
  mkdirSync(join(dir, 'mods'))
  mkdirSync(join(dir, 'disabled_mods'))
  writeFileSync(join(dir, 'mods', 'jei-1.20.1-15.2.0.jar'), 'x')
  writeFileSync(join(dir, 'mods', 'sodium.jar'), 'x')
  writeFileSync(join(dir, 'disabled_mods', 'optifine.jar'), 'x')
  writeFileSync(join(dir, 'mods', 'notes.txt'), 'x')
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('scanMods', () => {
  it('lists enabled and disabled jars', () => {
    const mods = scanMods(dir)
    expect(mods).toHaveLength(3)
    expect(mods.filter((m) => m.enabled).map((m) => m.filename).sort()).toEqual([
      'jei-1.20.1-15.2.0.jar',
      'sodium.jar'
    ])
    expect(mods.find((m) => m.filename === 'optifine.jar')!.enabled).toBe(false)
  })

  it('ignores files that are not jars', () => {
    expect(scanMods(dir).some((m) => m.filename === 'notes.txt')).toBe(false)
  })
})

describe('toggleMod', () => {
  it('disables an enabled mod by moving the jar', () => {
    toggleMod(dir, 'sodium.jar', false)
    expect(existsSync(join(dir, 'mods', 'sodium.jar'))).toBe(false)
    expect(existsSync(join(dir, 'disabled_mods', 'sodium.jar'))).toBe(true)
  })

  it('enables a disabled mod by moving the jar back', () => {
    toggleMod(dir, 'optifine.jar', true)
    expect(existsSync(join(dir, 'mods', 'optifine.jar'))).toBe(true)
    expect(existsSync(join(dir, 'disabled_mods', 'optifine.jar'))).toBe(false)
  })

  it('rejects a filename containing path separators', () => {
    expect(() => toggleMod(dir, '../evil.jar', false)).toThrow('Invalid mod filename')
  })
})

describe('prettyModName', () => {
  it('strips the extension and version noise', () => {
    expect(prettyModName('jei-1.20.1-15.2.0.jar')).toBe('jei')
    expect(prettyModName('sodium.jar')).toBe('sodium')
  })
})
