import { describe, it, expect } from 'vitest'
import {
  parseProperties,
  writeProperties,
  shaderDisplayName
} from '../src/main/lib/shaders-core'

// The real file Oculus writes, used verbatim so the tests fail if its shape
// stops matching what the launcher expects.
const REAL = [
  '#This file stores configuration options for Iris, such as the currently active shaderpack',
  '#Tue Jul 28 01:23:37 GMT 2026',
  'colorSpace=SRGB',
  'disableUpdateMessage=false',
  'enableDebugOptions=false',
  'maxShadowRenderDistance=12',
  'shaderPack=ComplementaryReimagined_r5.8.1.zip',
  'enableShaders=false',
  ''
].join('\n')

describe('parseProperties', () => {
  it('reads the keys the launcher depends on', () => {
    const parsed = parseProperties(REAL)
    expect(parsed.shaderPack).toBe('ComplementaryReimagined_r5.8.1.zip')
    expect(parsed.enableShaders).toBe('false')
  })

  it('skips comments and blank lines', () => {
    expect(parseProperties('# a=b\n\n!c=d\ne=f')).toEqual({ e: 'f' })
  })

  it('keeps equals signs that appear in the value', () => {
    expect(parseProperties('k=a=b').k).toBe('a=b')
  })
})

describe('writeProperties', () => {
  it('changes only the key asked for', () => {
    const out = writeProperties(REAL, { enableShaders: 'true' })
    expect(out).toContain('enableShaders=true')
    expect(out).toContain('maxShadowRenderDistance=12')
    expect(out).toContain('shaderPack=ComplementaryReimagined_r5.8.1.zip')
  })

  // Oculus's own header explains what the file is; losing it on the first
  // toggle would be a needless change to a file the player may open.
  it('preserves comments', () => {
    const out = writeProperties(REAL, { enableShaders: 'true' })
    expect(out).toContain('#This file stores configuration options for Iris')
  })

  it('appends a key that is not there yet', () => {
    const out = writeProperties('enableShaders=false\n', { shaderPack: 'BSL.zip' })
    expect(parseProperties(out)).toEqual({ enableShaders: 'false', shaderPack: 'BSL.zip' })
  })

  // A fresh instance has no file at all until the game has run once.
  it('builds a file from nothing', () => {
    const out = writeProperties('', { enableShaders: 'true', shaderPack: 'X.zip' })
    expect(parseProperties(out)).toEqual({ enableShaders: 'true', shaderPack: 'X.zip' })
  })

  it('does not grow trailing blank lines when written repeatedly', () => {
    let text = REAL
    for (let i = 0; i < 5; i += 1) text = writeProperties(text, { enableShaders: 'true' })
    expect(text.endsWith('\n')).toBe(true)
    expect(text.endsWith('\n\n')).toBe(false)
  })

  it('leaves the file alone when the patch is empty', () => {
    expect(parseProperties(writeProperties(REAL, {}))).toEqual(parseProperties(REAL))
  })
})

describe('shaderDisplayName', () => {
  it('turns the shipped archive name into something readable', () => {
    expect(shaderDisplayName('ComplementaryReimagined_r5.8.1.zip')).toBe(
      'Complementary Reimagined r5.8.1'
    )
  })

  it('handles hyphens and leaves plain names alone', () => {
    expect(shaderDisplayName('BSL-v8.2.zip')).toBe('BSL v8.2')
    expect(shaderDisplayName('Sildurs.zip')).toBe('Sildurs')
  })
})
