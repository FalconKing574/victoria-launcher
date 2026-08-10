/**
 * Remembers the sha1 of each jar so a modpack check does not have to read the
 * whole mods folder again.
 *
 * The check runs far more often than it looks: every time the player opens the
 * Jugar tab, every time they open Ajustes, and again after each sync. Each run
 * was hashing all 117 jars — 425 MB — with a synchronous readFileSync, on the
 * main process, which is the one thread that also draws the window and answers
 * IPC. Switching tabs froze the launcher for as long as the disk took.
 *
 * A file whose size and modification time are unchanged has not changed, so its
 * hash does not need recomputing. That turns the check into one statSync per
 * jar. Pure, so the rule that decides whether a cached hash is still trusted can
 * be tested without an instance on disk.
 */

/** What the filesystem says about a file, and all we need to spot a change. */
export interface FileStamp {
  size: number
  mtimeMs: number
}

export interface CacheEntry extends FileStamp {
  sha1: string
}

export type HashCache = Record<string, CacheEntry>

/**
 * Whether a cached hash can still be trusted for this file.
 *
 * Both fields must match. Size alone misses an in-place edit that keeps the
 * length; mtime alone misses a filesystem that rounds timestamps.
 */
export function isFresh(entry: CacheEntry | undefined, stamp: FileStamp): boolean {
  if (!entry) return false
  return entry.size === stamp.size && entry.mtimeMs === stamp.mtimeMs
}

/**
 * Drops entries for jars that are no longer in the folder.
 *
 * Without this the file grows forever: every mod ever removed from the pack
 * would keep its entry, and the cache would eventually be larger than the
 * listing it exists to speed up.
 */
export function pruneCache(cache: HashCache, present: readonly string[]): HashCache {
  const keep = new Set(present)
  const next: HashCache = {}
  for (const [filename, entry] of Object.entries(cache)) {
    if (keep.has(filename)) next[filename] = entry
  }
  return next
}

/** Parses a cache file, discarding anything that is not a well-formed entry. */
export function parseCache(raw: unknown): HashCache {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}

  const next: HashCache = {}
  for (const [filename, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) continue
    const { size, mtimeMs, sha1 } = value as Partial<CacheEntry>
    // A half-written or hand-edited entry must not be trusted as a hash: that
    // would let the launcher skip downloading a file it never verified.
    if (typeof size !== 'number' || typeof mtimeMs !== 'number') continue
    if (typeof sha1 !== 'string' || sha1.length !== 40) continue
    next[filename] = { size, mtimeMs, sha1 }
  }
  return next
}
