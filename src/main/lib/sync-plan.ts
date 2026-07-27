/**
 * Works out what a modpack sync must do. Pure: no filesystem, no network, so
 * the rules that decide whether a player's file gets deleted are testable.
 */

export interface ManifestMod {
  filename: string
  sha1: string
  sizeBytes: number
  url: string
}

export interface OptionalMod extends ManifestMod {
  id: string
  name: string
  summary: string
  category: 'rendimiento' | 'calidad-de-vida' | 'visual'
  /** Remote image shown on the card. Optional so the pack still works offline. */
  image?: string
}

export interface Manifest {
  packVersion: string
  minecraft: string
  forge: string
  mods: ManifestMod[]
  optional: OptionalMod[]
}

/** A jar currently sitting in the instance's mods folder. */
export interface LocalMod {
  filename: string
  sha1: string
}

export interface SyncPlan {
  download: ManifestMod[]
  remove: string[]
  keep: string[]
  upToDate: boolean
}

export interface PlanInput {
  manifest: Manifest
  local: LocalMod[]
  /**
   * Filenames the launcher installed on a previous sync. Anything not in here
   * is treated as the player's own and never deleted.
   */
  managed: string[]
  /** Optional mod ids the player has switched on. */
  enabledOptional: string[]
}

export function planSync({
  manifest,
  local,
  managed,
  enabledOptional
}: PlanInput): SyncPlan {
  const wanted = new Map<string, ManifestMod>()
  for (const mod of manifest.mods) wanted.set(mod.filename, mod)
  for (const mod of manifest.optional) {
    if (enabledOptional.includes(mod.id)) wanted.set(mod.filename, mod)
  }

  const localBy = new Map(local.map((mod) => [mod.filename, mod]))
  const managedSet = new Set(managed)

  const download: ManifestMod[] = []
  for (const [filename, mod] of wanted) {
    const present = localBy.get(filename)
    // Re-download when the hash differs: same name does not mean same file, and
    // a half-written jar from an interrupted download would otherwise persist.
    if (!present || present.sha1 !== mod.sha1) download.push(mod)
  }

  const remove: string[] = []
  const keep: string[] = []
  for (const mod of local) {
    if (wanted.has(mod.filename)) continue
    // Only ever delete something a previous sync put there. A jar the player
    // added by hand is theirs, and silently deleting it would be data loss.
    if (managedSet.has(mod.filename)) remove.push(mod.filename)
    else keep.push(mod.filename)
  }

  return {
    download,
    remove,
    keep,
    upToDate: download.length === 0 && remove.length === 0
  }
}

/** Filenames that should be recorded as managed after a plan is applied. */
export function nextManagedList(plan: SyncPlan, manifest: Manifest, managed: string[]): string[] {
  const removed = new Set(plan.remove)
  const next = new Set(managed.filter((filename) => !removed.has(filename)))
  for (const mod of plan.download) next.add(mod.filename)
  // Anything still required by the manifest stays managed even if it was
  // already present and therefore never downloaded.
  for (const mod of manifest.mods) {
    if (!removed.has(mod.filename)) next.add(mod.filename)
  }
  return [...next].sort()
}
