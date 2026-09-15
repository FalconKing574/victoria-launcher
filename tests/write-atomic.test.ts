import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

import { writeJsonAtomic } from '../src/main/lib/write-atomic'

/**
 * What this protects.
 *
 * modpack-state.json is the record of which jars the launcher installed. If a
 * write is interrupted and the file is left truncated, it fails to parse, the
 * launcher falls back to an empty state, and from then on every mod in the
 * folder counts as the player's own — so a mod dropped from a later manifest
 * could never be removed again. That is why this writes to a sibling and
 * renames instead of writing in place, and why it is worth a test.
 */
describe('writeJsonAtomic', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'victoria-atomic-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('writes JSON that reads back as the same value', () => {
    const path = join(dir, 'state.json')
    const value = { packVersion: '1.35.0', managed: ['victoriarp-1.47.0.jar'], parts: {} }

    writeJsonAtomic(path, value)

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(value)
  })

  it('leaves no .tmp sibling behind', () => {
    // A leftover .tmp is harmless on its own, but it means the rename did not
    // happen — which is the whole point of the function.
    const path = join(dir, 'state.json')
    writeJsonAtomic(path, { a: 1 })

    expect(readdirSync(dir)).toEqual(['state.json'])
  })

  it('replaces an existing file instead of failing', () => {
    // Every sync overwrites this file, so the second write is the normal case,
    // not the edge one. On Windows a plain rename onto an existing target used
    // to be the classic failure here.
    const path = join(dir, 'state.json')
    writeJsonAtomic(path, { version: 1 })
    writeJsonAtomic(path, { version: 2 })

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ version: 2 })
    expect(readdirSync(dir)).toEqual(['state.json'])
  })

  it('creates the folder when it does not exist yet', () => {
    // First run: the launcher root has just been made and nothing is in it.
    const path = join(dir, 'nested', 'deeper', 'state.json')

    writeJsonAtomic(path, { first: true })

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ first: true })
  })

  it('does not touch the previous file when the value cannot be serialised', () => {
    // The real risk: a bad write destroying good state. A circular value makes
    // JSON.stringify throw, and the old file has to survive untouched.
    const path = join(dir, 'state.json')
    writeJsonAtomic(path, { good: true })

    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(() => writeJsonAtomic(path, circular)).toThrow()
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ good: true })
    expect(existsSync(`${path}.tmp`)).toBe(false)
  })

  it('overwrites a stale .tmp left by an earlier interrupted write', () => {
    // If the process died mid-write once, the leftover must not block the next
    // attempt — otherwise the launcher would be stuck until someone deletes it
    // by hand.
    const path = join(dir, 'state.json')
    writeFileSync(`${path}.tmp`, 'basura a medio escribir', 'utf8')

    writeJsonAtomic(path, { recovered: true })

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ recovered: true })
    expect(readdirSync(dir)).toEqual(['state.json'])
  })

  it('round-trips the shape the launcher actually stores', () => {
    // Not a synthetic object: this is the real SyncState, nested parts and all.
    const path = join(dir, 'modpack-state.json')
    const state = {
      packVersion: '1.35.0',
      managed: ['victoriarp-1.47.0.jar', 'Immersive Vehicles-1.20.1-24.0.0.jar'],
      enabledOptional: ['distant-horizons'],
      overridesSha1: 'f'.repeat(40),
      overrideParts: { 'overrides-1.zip': 'a'.repeat(40), 'overrides-2.zip': 'b'.repeat(40) }
    }

    writeJsonAtomic(path, state)

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(state)
  })
})
