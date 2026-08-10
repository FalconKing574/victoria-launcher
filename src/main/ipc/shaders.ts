import { ipcMain } from 'electron'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, join } from 'path'
import { instanceDir, launcherRoot } from '../lib/paths'
import { parseProperties, writeProperties, shaderDisplayName } from '../lib/shaders-core'
import { extractRemoteEntry, listRemoteZip } from '../lib/remote-zip'
import { MANIFEST_URL } from '../config'
import type { Manifest } from '../lib/sync-plan'

/**
 * The shader mod in this pack is Oculus. It ships with the pack and is never
 * removed. Turning shaders "off" flips this file rather than uninstalling the
 * mod, which keeps the toggle instant — no download, no dependency to break
 * with Embeddium — and is exactly what the in-game shader screen writes.
 */
function configPath(): string {
  return join(instanceDir(), 'config', 'oculus.properties')
}

function shaderpacksDir(): string {
  return join(instanceDir(), 'shaderpacks')
}

/**
 * Where deleted shaderpacks are kept instead of being destroyed.
 *
 * Deleting used to be an rmSync, and the name went into shaders-removed.json so
 * the pack's own archives would not put it back. Between the two, a shader the
 * player deleted was gone for good: nothing in the launcher could return it,
 * and re-downloading it meant re-extracting a 177 MB override part. Moving the
 * file here makes the whole thing a rename in both directions, and a shaderpack
 * is 0.5-2.5 MB, so keeping it costs nothing worth counting.
 */
function shadersTrashDir(): string {
  return join(launcherRoot(), 'shaders-trash')
}

/**
 * Los shaders instalados que ahora mismo NO se usan.
 *
 * `shaderpacks/` dentro de la instancia queda con exactamente el que está en
 * uso, o vacía si están apagados: lo que no se usa no tiene por qué estar donde
 * Minecraft mira. Los demás se aparcan aquí, siguen instalados y siguen
 * saliendo en la lista del launcher.
 *
 * Consecuencia buscada: el menú de shaders del juego solo enseña el que está en
 * uso. Cambiar de shader se hace desde el launcher.
 */
function shadersLibraryDir(): string {
  return join(launcherRoot(), 'shaders-library')
}

export interface ShaderPack {
  filename: string
  name: string
  sizeBytes: number
}

export interface RemovedShaderPack extends ShaderPack {
  /**
   * True when the archive is sitting in the trash, so restoring it is instant.
   *
   * False for anything an older launcher deleted outright: the name is still on
   * the removed list, so the pack's archives keep putting it back and the
   * launcher keeps taking it out. Restoring one of those means dropping it from
   * the list and letting the next pack update reinstall it — slower, but it is
   * the difference between "later" and "never".
   */
  restorable: boolean
}

export interface ShaderSettings {
  /** False until the player opts in; shaders are a heavy, opt-in extra. */
  enabled: boolean
  /** Archive name Oculus will load, or null when nothing is chosen. */
  selected: string | null
  packs: ShaderPack[]
  /** Removed by the player. Empty in the normal case. */
  removed: RemovedShaderPack[]
  /** False before the modpack has been installed, so the UI can say why. */
  installed: boolean
}

function readConfig(): Record<string, string> {
  const path = configPath()
  if (!existsSync(path)) return {}
  try {
    return parseProperties(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

function patchConfig(patch: Record<string, string>): void {
  const path = configPath()
  mkdirSync(join(instanceDir(), 'config'), { recursive: true })
  // Missing file is normal on a fresh install: Oculus only writes it once the
  // game has run. Starting from empty lets the launcher set shaders up before
  // the first launch instead of after it.
  const original = existsSync(path) ? readFileSync(path, 'utf8') : ''
  writeFileSync(path, writeProperties(original, patch), 'utf8')
}

function listZips(dir: string): ShaderPack[] {
  if (!existsSync(dir)) return []

  return readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith('.zip'))
    .map((filename) => {
      let sizeBytes = 0
      try {
        sizeBytes = statSync(join(dir, filename)).size
      } catch {
        // A pack that vanished mid-listing is still worth showing by name.
      }
      return { filename, name: shaderDisplayName(filename), sizeBytes }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/**
 * Todo lo instalado, esté en uso o aparcado.
 *
 * La lista de la pantalla no cambia por mover archivos: el jugador ve sus
 * shaders igual, y dónde está cada uno es cosa del launcher.
 */
function listPacks(): ShaderPack[] {
  const byName = new Map<string, ShaderPack>()
  // El de la instancia manda: si por lo que sea hay copia en los dos sitios,
  // la buena es la que Minecraft está mirando.
  for (const pack of [...listZips(shaderpacksDir()), ...listZips(shadersLibraryDir())]) {
    if (!byName.has(pack.filename)) byName.set(pack.filename, pack)
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/**
 * Deja en `shaderpacks/` exactamente el shader en uso y aparca el resto.
 *
 * Es el único sitio que mueve archivos entre las dos carpetas, así que todas
 * las acciones acaban llamando aquí: elegir, apagar, borrar, recuperar y la
 * limpieza de después de actualizar el pack. Pasar `null` vacía la carpeta.
 */
function applySelection(inUse: string | null): void {
  const packs = shaderpacksDir()
  const library = shadersLibraryDir()

  for (const pack of listZips(packs)) {
    if (pack.filename !== inUse) moveShader(packs, library, pack.filename)
  }
  // No-op si ya estaba en su sitio.
  if (inUse) moveShader(library, packs, inUse)
}

/** Coloca los archivos según lo que diga la configuración ahora mismo. */
function syncFilesToConfig(): void {
  const current = getShaderSettings()
  applySelection(current.enabled ? current.selected : null)
}

/**
 * Everything the player removed, whether or not the archive was kept.
 *
 * Driven by the removed list rather than by the trash, so a shader an older
 * launcher deleted outright still shows up. Those are the ones that mattered:
 * their name stays on the list forever, so every pack update reinstalls them
 * and the launcher removes them again, with nothing in the interface to stop it.
 */
function listRemoved(): RemovedShaderPack[] {
  const inTrash = new Map(listZips(shadersTrashDir()).map((pack) => [pack.filename, pack]))
  // Anything still sitting in shaderpacks is not removed right now, whatever the
  // list says, and showing it in both places at once would just be confusing.
  const present = new Set(listPacks().map((pack) => pack.filename))

  return loadRemoved()
    .filter((filename) => !present.has(filename))
    .map((filename) => {
      const kept = inTrash.get(filename)
      return {
        filename,
        name: kept?.name ?? shaderDisplayName(filename),
        sizeBytes: kept?.sizeBytes ?? 0,
        restorable: kept !== undefined
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function getShaderSettings(): ShaderSettings {
  const config = readConfig()
  const packs = listPacks()
  const selected = config.shaderPack ?? null

  return {
    enabled: config.enableShaders === 'true',
    // A pack recorded in the config but missing from disk would render as a
    // selected row that does not exist in the list.
    selected: selected && packs.some((pack) => pack.filename === selected) ? selected : null,
    packs,
    removed: listRemoved(),
    // La carpeta de la instancia puede estar vacía a propósito — con los
    // shaders apagados no queda ninguno dentro —, así que la biblioteca cuenta
    // igual. Si no, apagarlos diría «todavía no has instalado el modpack».
    installed: existsSync(shaderpacksDir()) || existsSync(shadersLibraryDir())
  }
}

/**
 * Shaderpacks the player deleted.
 *
 * shaderpacks/ ships inside the pack's override archives, which are extracted
 * with overwrite, so without this record every deleted shader would reappear
 * the next time the pack's configuration changed. The launcher must not undo
 * something the player asked for.
 */
function removedListPath(): string {
  return join(launcherRoot(), 'shaders-removed.json')
}

function loadRemoved(): string[] {
  try {
    const parsed = JSON.parse(readFileSync(removedListPath(), 'utf8'))
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function saveRemoved(list: string[]): void {
  mkdirSync(launcherRoot(), { recursive: true })
  writeFileSync(removedListPath(), JSON.stringify(list, null, 2), 'utf8')
}

/**
 * Moves a shaderpack between the instance folder and the trash.
 *
 * Both directions are the same operation, so they share one function. Any
 * archive already sitting at the destination is dropped first: renameSync onto
 * an existing file is fine on Windows, but not across every filesystem, and the
 * copy being replaced is by definition the same pack.
 */
function moveShader(from: string, to: string, filename: string): boolean {
  const source = join(from, filename)
  if (!existsSync(source)) return false

  mkdirSync(to, { recursive: true })
  const target = join(to, filename)
  try {
    rmSync(target, { force: true })
    try {
      renameSync(source, target)
    } catch (error) {
      // The trash lives under userData while the instance can be moved onto
      // another drive with VICTORIA_INSTANCE_DIR, and rename cannot cross a
      // volume. Copying is slower but it is 2 MB, and the alternative is a
      // delete that silently does nothing.
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
      copyFileSync(source, target)
      rmSync(source, { force: true })
    }
    return true
  } catch {
    // Locked by the running game, or a permission the antivirus took away.
    return false
  }
}

/**
 * Takes the player's deleted shaders back out after the pack's archives put
 * them there again. Called after overrides are applied.
 *
 * They go to the trash rather than being destroyed, so "restaurar" keeps
 * working after a pack update instead of only until the next one.
 */
export function pruneDeletedShaders(): void {
  const dir = shaderpacksDir()
  if (!existsSync(dir)) return
  for (const filename of loadRemoved()) {
    moveShader(dir, shadersTrashDir(), basename(filename))
  }
  // El pack acaba de dejar TODOS sus shaderpacks dentro de la instancia otra
  // vez. Aparcar los que no se usan es lo que mantiene la carpeta con solo el
  // que está en uso después de cada actualización, no solo al pulsar botones.
  syncFilesToConfig()
}

/**
 * Vuelve a bajar un shaderpack que ya no está en disco, en el momento.
 *
 * Los shaderpacks viajan dentro de los `overrides-*.zip` del pack, y el más
 * grande pesa 177 MB. Antes, recuperar uno borrado por una versión antigua del
 * launcher significaba esperar a la siguiente actualización del modpack — es
 * decir, no recuperarlo. Un zip guarda su índice al final y dice en qué byte
 * empieza cada archivo, así que con peticiones Range se baja solo el shader:
 * un par de MB en vez de 177.
 *
 * Devuelve false si no se pudo, y entonces la pantalla lo dice en vez de fingir.
 */
async function redownloadShader(filename: string): Promise<boolean> {
  if (!MANIFEST_URL) return false

  let manifest: Manifest
  try {
    manifest = (await (await fetch(MANIFEST_URL, { cache: 'no-store' } as RequestInit)).json()) as Manifest
  } catch {
    return false
  }

  const dentro = `shaderpacks/${filename}`
  for (const part of manifest.overrides ?? []) {
    try {
      const entrada = (await listRemoteZip(part.url)).find((e) => e.name === dentro)
      if (!entrada) continue
      await extractRemoteEntry(part.url, entrada, join(shaderpacksDir(), filename))
      return true
    } catch {
      // Parte ilegible o sin soporte de rangos: se prueba con la siguiente.
    }
  }
  return false
}

export function registerShaderHandlers(): void {
  // Al abrir el launcher, dejar la carpeta como dice la configuración. Cubre lo
  // que pasó fuera de aquí: una instancia que viene de una versión anterior con
  // los tres shaders dentro, o un .zip que el jugador copió a mano.
  try {
    syncFilesToConfig()
  } catch {
    // Colocar archivos no puede impedir que el launcher abra.
  }

  ipcMain.handle('shaders:get', () => getShaderSettings())

  ipcMain.handle('shaders:set-enabled', (_event, enabled: boolean) => {
    const patch: Record<string, string> = { enableShaders: String(enabled) }

    // Turning shaders on with nothing selected loads nothing and looks broken,
    // so adopt the first installed pack.
    if (enabled) {
      const current = getShaderSettings()
      if (!current.selected && current.packs.length > 0) {
        patch.shaderPack = current.packs[0].filename
      }
    }

    patchConfig(patch)
    // Apagarlos saca el .zip de la instancia; encenderlos lo devuelve.
    syncFilesToConfig()
    return getShaderSettings()
  })

  ipcMain.handle('shaders:select', (_event, filename: string) => {
    patchConfig({ shaderPack: basename(filename) })
    // El anterior se aparca y entra el nuevo, así que en la carpeta solo queda
    // el que se va a usar.
    syncFilesToConfig()
    return getShaderSettings()
  })

  /**
   * Deja de usar el shader actual SIN apagar Oculus.
   *
   * Antes el botón «Dejar de usar» llamaba a set-enabled(false), y eso apagaba
   * el interruptor maestro: te quedabas sin poder elegir ningún otro shader,
   * que es lo contrario de lo que pide quien solo quiere quitarse este. Vaciar
   * `shaderPack` deja Oculus encendido y el juego arranca sin shader.
   */
  ipcMain.handle('shaders:deselect', () => {
    patchConfig({ shaderPack: '' })
    syncFilesToConfig()
    return getShaderSettings()
  })

  ipcMain.handle('shaders:delete', (_event, filename: string) => {
    // basename, not the raw argument: this joins straight onto a path, and a
    // filename is all the renderer ever legitimately sends.
    const safe = basename(filename)
    // Puede estar en uso dentro de la instancia o aparcado en la biblioteca.
    if (!moveShader(shaderpacksDir(), shadersTrashDir(), safe)) {
      moveShader(shadersLibraryDir(), shadersTrashDir(), safe)
    }

    const removed = loadRemoved()
    if (!removed.includes(safe)) saveRemoved([...removed, safe])

    // A config still pointing at a deleted archive makes Oculus load nothing
    // and look broken, so move the selection to whatever is left.
    if (readConfig().shaderPack === safe) {
      const rest = listPacks()
      patchConfig(
        rest.length > 0
          ? { shaderPack: rest[0].filename }
          : { shaderPack: '', enableShaders: 'false' }
      )
    }

    syncFilesToConfig()
    return getShaderSettings()
  })

  ipcMain.handle('shaders:restore', async (_event, filename: string) => {
    const safe = basename(filename)

    // Vuelve a la biblioteca, no a la instancia: recuperarlo no significa
    // ponérselo. Si resulta ser el que estaba en uso, syncFilesToConfig lo
    // coloca.
    let recuperado = moveShader(shadersTrashDir(), shadersLibraryDir(), safe)

    // Sin copia guardada — lo borró una versión anterior del launcher — se baja
    // del pack en el momento. Esperar a la siguiente actualización del modpack
    // era, en la práctica, no recuperarlo.
    if (!recuperado) {
      recuperado = await redownloadShader(safe)
      if (recuperado) moveShader(shaderpacksDir(), shadersLibraryDir(), safe)
    }

    // Fuera de la lista de bloqueo en cualquier caso: mientras siga ahí, cada
    // actualización del pack se lo volvería a llevar.
    saveRemoved(loadRemoved().filter((entry) => entry !== safe))

    syncFilesToConfig()
    return { ...getShaderSettings(), recuperado }
  })
}
