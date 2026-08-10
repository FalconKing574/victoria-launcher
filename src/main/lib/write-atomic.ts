import { mkdirSync, renameSync, rmSync, writeFileSync } from 'fs'
import { dirname } from 'path'

/**
 * Writes JSON so an interrupted write cannot leave a half-file behind.
 *
 * modpack-state.json is the record of which jars the launcher installed. If it
 * is truncated — the PC loses power, the process is killed mid-write — it fails
 * to parse, the launcher falls back to an empty state, and from then on every
 * mod in the folder counts as the player's own. That is not a cosmetic loss:
 * the deletion rule only ever touches files it installed itself, so a mod
 * dropped from a later manifest could never be removed again.
 *
 * Writing to a sibling and renaming makes the swap atomic on both NTFS and
 * every filesystem the launcher will realistically meet.
 */
export function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })

  const partial = `${path}.tmp`
  try {
    writeFileSync(partial, JSON.stringify(value, null, 2), 'utf8')
    // Node's rename replaces an existing target on Windows too (MoveFileEx with
    // MOVEFILE_REPLACE_EXISTING), so there is no window where the file is gone.
    renameSync(partial, path)
  } catch (error) {
    rmSync(partial, { force: true })
    throw error
  }
}
