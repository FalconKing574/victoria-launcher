import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import AdmZip from 'adm-zip'
import { launcherRoot } from './paths'
import { downloadVerified } from './download'
import { MIN_JAVA_MAJOR, javaCandidates, parseJavaMajor, pickJavaPath } from './java'

/**
 * Where the launcher keeps the Java it installed itself, kept apart from the
 * instance so wiping a broken modpack never costs a 42 MB re-download.
 */
function javaDir(): string {
  return join(launcherRoot(), 'java')
}

/**
 * Eclipse Temurin, queried rather than hardcoded so players always get the
 * current security patch instead of whatever was current when this shipped.
 * The response carries a sha256, which is what makes the download verifiable.
 */
const ADOPTIUM_API =
  'https://api.adoptium.net/v3/assets/latest/17/hotspot' +
  '?os=windows&architecture=x64&image_type=jre&vendor=eclipse'

interface AdoptiumAsset {
  release_name: string
  binary: { package: { name: string; link: string; checksum: string; size: number } }
}

/** Finds the javaw.exe inside whatever folder name the JRE archive unpacked to. */
function findManagedJava(): string | null {
  const dir = javaDir()
  if (!existsSync(dir)) return null

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const candidate = join(dir, entry.name, 'bin', 'javaw.exe')
    if (existsSync(candidate)) return candidate
  }
  return null
}

/**
 * Asks a Java executable what version it is. Returns null when it cannot run at
 * all, which is the normal answer for the bare `java` fallback on a machine
 * that has never had Java installed.
 */
export function probeJavaMajor(path: string): number | null {
  try {
    const result = spawnSync(path, ['-version'], { encoding: 'utf8', timeout: 10_000 })
    if (result.error || result.status !== 0) return null
    // `java -version` writes to stderr, but not on every distribution.
    return parseJavaMajor(`${result.stderr ?? ''}${result.stdout ?? ''}`)
  } catch {
    return null
  }
}

async function downloadJava(
  onStatus: (message: string) => void,
  onProgress: (percent: number) => void
): Promise<string> {
  onStatus('Buscando Java 17...')

  let asset: AdoptiumAsset
  try {
    const response = await fetch(ADOPTIUM_API)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const assets = (await response.json()) as AdoptiumAsset[]
    if (!assets.length) throw new Error('respuesta vacía')
    asset = assets[0]
  } catch (error) {
    throw new Error(
      'El launcher no encontró Java en tu PC y no pudo descargarlo ' +
        `(${(error as Error).message}).\n\n` +
        'Comprueba tu conexión y vuelve a intentarlo, o instala Java 17 a mano ' +
        'desde adoptium.net y elige su ruta en Ajustes.'
    )
  }

  const pkg = asset.binary.package
  const archive = join(javaDir(), pkg.name)

  await downloadVerified(pkg.link, archive, {
    expected: pkg.checksum,
    algo: 'sha256',
    label: `Java 17 (${asset.release_name})`,
    onProgress: (received, total) => {
      if (total > 0) onProgress(Math.round((received / total) * 100))
    }
  })

  onStatus('Instalando Java...')
  try {
    new AdmZip(archive).extractAllTo(javaDir(), true)
  } catch (error) {
    throw new Error(
      `No se pudo descomprimir Java: ${(error as Error).message}\n\n` +
        'Si el antivirus está bloqueando la carpeta del launcher, añádela a las excepciones.'
    )
  }
  rmSync(archive, { force: true })

  const installed = findManagedJava()
  if (!installed) {
    throw new Error('Java se descargó pero no se encontró javaw.exe dentro. Inténtalo de nuevo.')
  }
  return installed
}

/**
 * Returns a Java that can actually run Minecraft 1.20.1, installing one if the
 * machine has none.
 *
 * Before this existed the launcher only looked inside CurseForge, JAVA_HOME and
 * PATH, then fell back to the bare string `java`. On a PC that had never had
 * Java that failed to spawn, MCLC returned null, and the player got
 * "No se pudo iniciar Minecraft. Revisa la ruta de Java en Ajustes." — advice
 * they had no way to act on. Every real launcher ships its own runtime instead.
 *
 * System installs are version-checked rather than trusted: a Java 8 on PATH
 * spawns fine and then dies inside Minecraft with an UnsupportedClassVersion
 * error nobody can read.
 */
/**
 * Major version per Java path, for this run only.
 *
 * probeJavaMajor spawns `java -version` and blocks until it answers, on the
 * same thread that draws the window. A player whose PC already has a good
 * Java 17 never installs the managed one, so that spawn happened on every
 * single press of JUGAR. A Java that answered "17" a minute ago still does.
 *
 * Deliberately not persisted: a fresh start re-checks, which is what notices
 * that the player uninstalled or upgraded it.
 */
const probed = new Map<string, number | null>()

function probeJavaMajorCached(path: string): number | null {
  const remembered = probed.get(path)
  if (remembered !== undefined) return remembered

  const major = probeJavaMajor(path)
  probed.set(path, major)
  return major
}

export async function ensureJava(
  override: string | null,
  onStatus: (message: string) => void,
  onProgress: (percent: number) => void
): Promise<string> {
  // An explicit choice in Ajustes wins outright. Someone who typed a path is
  // troubleshooting, and second-guessing them there helps nobody.
  if (override && existsSync(override)) return override

  const managed = findManagedJava()
  if (managed) return managed

  const system = pickJavaPath({ override: null, candidates: javaCandidates(), exists: existsSync })
  if (!probed.has(system)) onStatus('Comprobando Java...')
  const major = probeJavaMajorCached(system)
  if (major !== null && major >= MIN_JAVA_MAJOR) return system

  mkdirSync(javaDir(), { recursive: true })
  return downloadJava(onStatus, onProgress)
}
