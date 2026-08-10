/**
 * Reading and editing Oculus's settings file.
 *
 * Oculus is the shader mod this pack ships, and it stores its state in a plain
 * Java .properties file. Pure so it can be tested without an instance on disk.
 */

/** Reads `key=value` lines, ignoring comments and blanks. */
export function parseProperties(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return out
}

/**
 * Rewrites only the keys in `patch`, leaving every other line — including
 * Oculus's own comments and any setting the player changed in-game — exactly
 * where it was. Keys that are not present yet get appended.
 */
export function writeProperties(original: string, patch: Record<string, string>): string {
  const remaining = new Map(Object.entries(patch))

  const lines = original.split(/\r?\n/).map((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) return line

    const eq = trimmed.indexOf('=')
    if (eq === -1) return line

    const key = trimmed.slice(0, eq).trim()
    if (!remaining.has(key)) return line

    const value = remaining.get(key) as string
    remaining.delete(key)
    return `${key}=${value}`
  })

  for (const [key, value] of remaining) lines.push(`${key}=${value}`)

  // Trailing blank lines would otherwise multiply on every write.
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return `${lines.join('\n')}\n`
}

/**
 * Turns `ComplementaryReimagined_r5.8.1.zip` into
 * `Complementary Reimagined r5.8.1`, so the list reads like a name instead of a
 * filename. The archive name is still what gets written to the config.
 */
export function shaderDisplayName(filename: string): string {
  return filename
    .replace(/\.zip$/i, '')
    .replace(/[_-]+/g, ' ')
    // Split camel case, but leave version tokens like r5.8.1 alone.
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}
