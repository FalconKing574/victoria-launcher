import { describe, it, expect } from 'vitest'
import { planSync, nextManagedList, type Manifest } from '../src/main/lib/sync-plan'

const manifest: Manifest = {
  packVersion: '1.0.0',
  minecraft: '1.20.1',
  forge: '47.4.0',
  mods: [
    { filename: 'jei.jar', sha1: 'aaa', sizeBytes: 1, url: 'https://x/jei.jar' },
    { filename: 'embeddium.jar', sha1: 'bbb', sizeBytes: 1, url: 'https://x/embeddium.jar' }
  ],
  optional: [
    {
      id: 'xaeros-minimap',
      name: "Xaero's Minimap",
      summary: 'Minimapa',
      category: 'calidad-de-vida',
      filename: 'xaeros.jar',
      sha1: 'ccc',
      sizeBytes: 1,
      url: 'https://x/xaeros.jar'
    }
  ]
}

describe('planSync', () => {
  it('downloads everything when the instance is empty', () => {
    const plan = planSync({ manifest, local: [], managed: [], enabledOptional: [] })
    expect(plan.download.map((m) => m.filename)).toEqual(['jei.jar', 'embeddium.jar'])
    expect(plan.upToDate).toBe(false)
  })

  it('reports up to date when hashes all match', () => {
    const plan = planSync({
      manifest,
      local: [
        { filename: 'jei.jar', sha1: 'aaa' },
        { filename: 'embeddium.jar', sha1: 'bbb' }
      ],
      managed: ['jei.jar', 'embeddium.jar'],
      enabledOptional: []
    })
    expect(plan.upToDate).toBe(true)
    expect(plan.download).toEqual([])
    expect(plan.remove).toEqual([])
  })

  it('re-downloads a file whose hash changed', () => {
    const plan = planSync({
      manifest,
      local: [
        { filename: 'jei.jar', sha1: 'OUTDATED' },
        { filename: 'embeddium.jar', sha1: 'bbb' }
      ],
      managed: ['jei.jar', 'embeddium.jar'],
      enabledOptional: []
    })
    expect(plan.download.map((m) => m.filename)).toEqual(['jei.jar'])
  })

  it('NEVER deletes a jar the player added themselves', () => {
    const plan = planSync({
      manifest,
      local: [
        { filename: 'jei.jar', sha1: 'aaa' },
        { filename: 'embeddium.jar', sha1: 'bbb' },
        { filename: 'mi-mod-personal.jar', sha1: 'zzz' }
      ],
      managed: ['jei.jar', 'embeddium.jar'],
      enabledOptional: []
    })
    expect(plan.remove).toEqual([])
    expect(plan.keep).toEqual(['mi-mod-personal.jar'])
  })

  it('removes a jar that a previous sync installed and the manifest dropped', () => {
    const plan = planSync({
      manifest,
      local: [
        { filename: 'jei.jar', sha1: 'aaa' },
        { filename: 'embeddium.jar', sha1: 'bbb' },
        { filename: 'create.jar', sha1: 'old' }
      ],
      managed: ['jei.jar', 'embeddium.jar', 'create.jar'],
      enabledOptional: []
    })
    expect(plan.remove).toEqual(['create.jar'])
  })

  it('installs an optional mod only once the player enables it', () => {
    const off = planSync({ manifest, local: [], managed: [], enabledOptional: [] })
    expect(off.download.map((m) => m.filename)).not.toContain('xaeros.jar')

    const on = planSync({
      manifest,
      local: [],
      managed: [],
      enabledOptional: ['xaeros-minimap']
    })
    expect(on.download.map((m) => m.filename)).toContain('xaeros.jar')
  })

  it('removes an optional mod the player turned back off', () => {
    const plan = planSync({
      manifest,
      local: [
        { filename: 'jei.jar', sha1: 'aaa' },
        { filename: 'embeddium.jar', sha1: 'bbb' },
        { filename: 'xaeros.jar', sha1: 'ccc' }
      ],
      managed: ['jei.jar', 'embeddium.jar', 'xaeros.jar'],
      enabledOptional: []
    })
    expect(plan.remove).toEqual(['xaeros.jar'])
  })
})

describe('nextManagedList', () => {
  it('adds downloads and drops removals', () => {
    const plan = planSync({
      manifest,
      local: [{ filename: 'create.jar', sha1: 'old' }],
      managed: ['create.jar'],
      enabledOptional: []
    })
    const next = nextManagedList(plan, manifest, ['create.jar'])
    expect(next).toEqual(['embeddium.jar', 'jei.jar'])
  })

  it('keeps tracking a required mod that was already present', () => {
    const plan = planSync({
      manifest,
      local: [
        { filename: 'jei.jar', sha1: 'aaa' },
        { filename: 'embeddium.jar', sha1: 'bbb' }
      ],
      managed: [],
      enabledOptional: []
    })
    // Nothing to download, but both are the pack's files from now on.
    expect(nextManagedList(plan, manifest, [])).toEqual(['embeddium.jar', 'jei.jar'])
  })

  it('adopts every required mod so a later manifest can drop it', () => {
    // Without this a first sync leaves managed empty, and the deletion rule --
    // which only touches files the launcher installed -- could never remove a
    // mod the pack later drops.
    const plan = planSync({
      manifest,
      local: [
        { filename: 'jei.jar', sha1: 'aaa' },
        { filename: 'embeddium.jar', sha1: 'bbb' }
      ],
      managed: [],
      enabledOptional: []
    })
    const adopted = nextManagedList(plan, manifest, [])

    const dropped: Manifest = { ...manifest, mods: [manifest.mods[0]] }
    const second = planSync({
      manifest: dropped,
      local: [
        { filename: 'jei.jar', sha1: 'aaa' },
        { filename: 'embeddium.jar', sha1: 'bbb' }
      ],
      managed: adopted,
      enabledOptional: []
    })
    expect(second.remove).toEqual(['embeddium.jar'])
  })

  it('does not adopt a player-added jar as managed', () => {
    const plan = planSync({
      manifest,
      local: [{ filename: 'mi-mod-personal.jar', sha1: 'zzz' }],
      managed: [],
      enabledOptional: []
    })
    expect(nextManagedList(plan, manifest, [])).not.toContain('mi-mod-personal.jar')
  })
})
