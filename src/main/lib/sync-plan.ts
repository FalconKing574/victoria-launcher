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

/**
 * config/, resourcepacks/ and shaderpacks/ shipped as one archive.
 *
 * Those are ~520 files and the launcher needs all of them for the FancyMenu
 * menu, the Victoria resource pack and every mod's settings to be right. Listing
 * them individually would mean hundreds of round trips; one archive with one
 * hash is both faster and atomically verifiable.
 */
export interface OverridePart {
  name: string
  sha1: string
  sizeBytes: number
  url: string
}

/**
 * Split into parts because the upload tooling caps single files at 300 MiB and
 * this pack's config folder is 614 MiB, most of it menu videos. Each part is an
 * independent archive; extracting them in order reconstitutes the folders.
 */
export type ManifestOverrides = OverridePart[]

/** One hash covering every part, so a changed part invalidates the whole set. */
export function overridesFingerprint(parts: ManifestOverrides): string {
  return parts.map((part) => part.sha1).join('-')
}

/**
 * El servidor de autenticacion de Victoria, si lo hay.
 *
 * Viene en el manifiesto y no escrito en el launcher a proposito: asi rotar la
 * llave es editar un archivo en R2 y no publicar una version nueva de la app y
 * esperar a que le llegue a todos. Ver `lib/victoria-auth.ts`.
 *
 * Opcional: sin esto el launcher se comporta como siempre y el jugador escribe
 * `/login` adentro del juego.
 */
export interface ManifestAuth {
  host: string
  puerto: number
  /** Llave publica DER/SPKI en base64. */
  llave: string
}

/**
 * Una SIEMBRA: se instala una sola vez y despues es del jugador.
 *
 * ## Por que no puede ir en los overrides
 *
 * Los overrides se extraen **pisando** en cada actualizacion. Eso esta bien para
 * las configs, que las decidimos nosotros, y esta MAL para cualquier carpeta que
 * el jugador escriba mientras juega: se la borrariamos en cada update.
 *
 * El caso que motivo esto es el mapa de Xaero. La ciudad tiene que venir ya
 * explorada --sin eso el mapa arranca negro y el taxi no sirve para lo unico que
 * necesita, que es mirar de donde a donde hay que ir-- pero esa carpeta la
 * reescribe el jugador con cada cuadra que camina. Mandarla en los overrides
 * seria borrarle su propia exploracion cada vez que actualiza.
 *
 * ## Como se decide si se instala
 *
 * Por la EXISTENCIA de `destino`, no por un hash. Si la carpeta ya esta, el
 * jugador ya jugo y lo que tiene adentro vale mas que lo nuestro. Si no esta, es
 * una instalacion nueva y se siembra.
 */
export interface ManifestSeed {
  /** Que se siembra, para el mensaje en pantalla. */
  nombre: string
  /**
   * La ruta, relativa a la instancia, que decide si ya esta sembrado.
   *
   * Se comprueba que EXISTA. Apuntar a la carpeta del mundo y no al zip es a
   * proposito: lo que importa es si el jugador ya tiene mapa, no si alguna vez
   * bajamos el archivo.
   */
  destino: string
  sha1: string
  sizeBytes: number
  url: string
}

export interface Manifest {
  packVersion: string
  minecraft: string
  forge: string
  mods: ManifestMod[]
  optional: OptionalMod[]
  overrides?: ManifestOverrides
  auth?: ManifestAuth
  /** Lo que se instala solo en la primera instalacion. Ver {@link ManifestSeed}. */
  siembra?: ManifestSeed[]
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
