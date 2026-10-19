import { createHash } from 'crypto'
import { createReadStream, existsSync, readdirSync, rmSync, statSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import AdmZip from 'adm-zip'
import { isFresh, parseCache, type HashCache } from './hash-cache'

/**
 * Repara la instalación de Minecraft y Forge antes de jugar (17-10-2026).
 *
 * <h2>El error que lo motivó</h2>
 *
 * Un jugador, al apretar JUGAR: «Failed to run processor: java.io.EOFException: Unexpected end of ZLIB
 * input stream». Es el instalador de Forge (lo corre ForgeWrapper al arrancar): para armar el jar de
 * Forge procesa el jar de Minecraft y varias librerías, y una de ellas estaba dañada — típicamente una
 * descarga que se cortó a mitad. MCLC sólo mira si el archivo EXISTE, no si está entero, así que el jar
 * roto quedaba para siempre y el error se repetía en cada intento.
 *
 * <h2>Qué hace</h2>
 *
 * Revisa con SHA-1 el jar de Minecraft y cada librería contra los hashes que publican Mojang y Forge (están
 * en las JSON de versión que ya bajó MCLC). Lo que no coincide se borra: MCLC lo vuelve a bajar en este
 * mismo arranque. Si se borró algo, o si el arranque anterior falló procesando Forge, también se borran las
 * salidas de los procesadores para que Forge las arme de nuevo con los archivos sanos. El hash de cada
 * archivo se guarda por tamaño y fecha (como el de los mods): después de la primera vez cuesta un stat.
 *
 * <h2>Lo que faltaba (18-10-2026)</h2>
 *
 * El error volvió a aparecer. Dos huecos: el instalador de Forge sólo se abría como zip (un instalador con
 * el índice sano y un dato del medio roto pasaba la prueba), y la reparación esperaba al PRÓXIMO JUGAR, así
 * que el jugador veía el error, no sabía qué hacer y lo reportaba. Ahora el instalador se compara con el
 * SHA-1 que publica Forge, y `profundo` borra todo lo de Forge para que se baje de cero: es lo que usa el
 * reintento automático después de un fallo y el botón «Reparar» de Ajustes.
 */

export interface Artefacto {
  /** Ruta relativa a la raíz de Minecraft del launcher, con barras normales. */
  ruta: string
  sha1: string
}

interface ArtefactoJson {
  path?: unknown
  sha1?: unknown
}

function deArtifact(a: ArtefactoJson | undefined, prefijo: string, out: Artefacto[]): void {
  if (!a || typeof a.path !== 'string' || typeof a.sha1 !== 'string' || a.sha1.length !== 40) return
  out.push({ ruta: `${prefijo}/${a.path}`, sha1: a.sha1.toLowerCase() })
}

/**
 * Los archivos con hash conocido de una JSON de versión (la de Mojang o la que arma MCLC para Forge):
 * cada librería (y sus nativos) y, en la de Forge, los `mavenFiles` que usan los procesadores.
 */
export function artefactosDe(json: unknown): Artefacto[] {
  const out: Artefacto[] = []
  if (typeof json !== 'object' || json === null) return out
  const j = json as Record<string, unknown>
  for (const lista of [j.libraries, j.mavenFiles]) {
    if (!Array.isArray(lista)) continue
    for (const lib of lista) {
      const d = (lib as { downloads?: Record<string, unknown> })?.downloads
      if (!d) continue
      deArtifact(d.artifact as ArtefactoJson, 'libraries', out)
      const clasif = d.classifiers as Record<string, ArtefactoJson> | undefined
      if (clasif && typeof clasif === 'object') {
        for (const c of Object.values(clasif)) deArtifact(c, 'libraries', out)
      }
    }
  }
  return out
}

/** El jar de Minecraft de una JSON de Mojang, o null. */
export function jarCliente(json: unknown, version: string): Artefacto | null {
  const sha1 = (json as { downloads?: { client?: { sha1?: unknown } } })?.downloads?.client?.sha1
  if (typeof sha1 !== 'string' || sha1.length !== 40) return null
  return { ruta: `versions/${version}/${version}.jar`, sha1: sha1.toLowerCase() }
}

/** Si un renglón de la salida del juego dice que Forge no pudo procesar sus archivos. */
export function esFalloDeForge(linea: string): boolean {
  return /Failed to run processor|Unexpected end of ZLIB|java\.util\.zip\.ZipException|EOFException.*(?:jar|zip|ZLIB)/i.test(
    linea
  )
}

function sha1De(ruta: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha1')
    createReadStream(ruta)
      .on('data', (c) => h.update(c))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')))
  })
}

async function leerJson(ruta: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(ruta, 'utf-8'))
  } catch {
    return null
  }
}

const MARCA = 'reparar-forge.flag'

/** Lo anota el arranque cuando Forge falló procesando: el próximo JUGAR rehace todo lo de Forge. */
export async function marcarFalloForge(root: string): Promise<void> {
  await mkdir(join(root, 'cache'), { recursive: true })
  await writeFile(join(root, 'cache', MARCA), new Date().toISOString())
}

export interface OpcionesReparacion {
  /** Borra todo lo de Forge (librerías, salidas de los procesadores, JSON) para que se baje de cero. */
  profundo?: boolean
  /** El SHA-1 publicado del instalador; si no coincide, se borra y se vuelve a bajar. */
  instaladorSha1?: string
}

/** Las carpetas de `libraries` que son de Forge o de sus procesadores: lo que borra la reparación profunda. */
export const CARPETAS_FORGE = [
  ['net', 'minecraftforge'],
  ['net', 'minecraft', 'client'],
  ['de', 'oceanlabs'],
  ['cpw', 'mods'],
  ['io', 'github', 'zekerzhayard']
]

export interface ResultadoRevision {
  revisados: number
  borrados: string[]
  forgeRehecho: boolean
}

/**
 * Revisa y repara. Nunca tira: si algo no se puede leer, lo deja como está (MCLC hará lo de siempre).
 */
export async function repararMinecraft(
  root: string,
  mc: string,
  forge: string,
  instalador: string | null,
  avisar: (mensaje: string) => void,
  opciones: OpcionesReparacion = {}
): Promise<ResultadoRevision> {
  const borrados: string[] = []

  if (opciones.profundo) {
    avisar('Reinstalando Forge desde cero...')
    for (const partes of CARPETAS_FORGE) {
      const dir = join(root, 'libraries', ...partes)
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true })
        borrados.push(`libraries/${partes.join('/')}`)
      }
    }
    // sin la JSON de Forge, MCLC la vuelve a armar desde el instalador y baja todo lo que nombra
    rmSync(join(root, 'forge', mc), { recursive: true, force: true })
  }

  const cachePath = join(root, 'cache', 'verificacion-minecraft.json')
  const cache: HashCache = parseCache(await leerJson(cachePath))
  const nuevo: HashCache = {}

  const vanilla = await leerJson(join(root, 'versions', mc, `${mc}.json`))
  const deForge = await leerJson(join(root, 'forge', mc, 'version.json'))
  const lista: Artefacto[] = [...artefactosDe(vanilla), ...artefactosDe(deForge)]
  const cliente = jarCliente(vanilla, mc)
  if (cliente) lista.unshift(cliente)

  let revisados = 0
  if (lista.length > 0) avisar('Revisando los archivos de Minecraft...')
  for (const a of lista) {
    const ruta = join(root, ...a.ruta.split('/'))
    let st
    try {
      st = statSync(ruta)
    } catch {
      continue // falta: MCLC lo baja
    }
    revisados++
    const stamp = { size: st.size, mtimeMs: st.mtimeMs }
    let sha1 = isFresh(cache[a.ruta], stamp) ? cache[a.ruta].sha1 : null
    if (!sha1) {
      try {
        sha1 = await sha1De(ruta)
      } catch {
        continue
      }
    }
    if (sha1 !== a.sha1) {
      rmSync(ruta, { force: true })
      borrados.push(a.ruta)
      continue
    }
    nuevo[a.ruta] = { ...stamp, sha1 }
  }

  // El instalador de Forge: con el hash publicado se compara entero; sin él, al menos que abra como zip.
  // Lo que falla se borra y ensureForgeInstaller lo vuelve a bajar.
  if (instalador && existsSync(instalador)) {
    let sano = true
    if (opciones.instaladorSha1) {
      const clave = 'forge/installer'
      try {
        const st = statSync(instalador)
        const stamp = { size: st.size, mtimeMs: st.mtimeMs }
        const sha1 = isFresh(cache[clave], stamp) ? cache[clave].sha1 : await sha1De(instalador)
        sano = sha1 === opciones.instaladorSha1.toLowerCase()
        if (sano) nuevo[clave] = { ...stamp, sha1 }
      } catch {
        sano = false
      }
    } else {
      try {
        new AdmZip(instalador).getEntries()
      } catch {
        sano = false
      }
    }
    if (!sano) {
      rmSync(instalador, { force: true })
      borrados.push('forge installer')
    }
  }

  const marca = join(root, 'cache', MARCA)
  const falloAntes = existsSync(marca)
  const forgeRehecho = falloAntes || borrados.length > 0 || opciones.profundo === true
  if (forgeRehecho) {
    avisar('Reparando la instalación de Forge...')
    // las salidas de los procesadores: el jar de Minecraft parcheado y el de Forge para el cliente
    const clienteDir = join(root, 'libraries', 'net', 'minecraft', 'client')
    if (existsSync(clienteDir)) {
      for (const d of readdirSync(clienteDir)) {
        if (d.startsWith(`${mc}-`)) rmSync(join(clienteDir, d), { recursive: true, force: true })
      }
    }
    rmSync(join(root, 'libraries', 'net', 'minecraftforge', 'forge', `${mc}-${forge}`, `forge-${mc}-${forge}-client.jar`), {
      force: true
    })
    // la JSON que arma MCLC desde el instalador: se rehace sola
    rmSync(join(root, 'forge', mc), { recursive: true, force: true })
    rmSync(marca, { force: true })
  }

  try {
    await mkdir(join(root, 'cache'), { recursive: true })
    await writeFile(cachePath, JSON.stringify(nuevo))
  } catch {
    // la caché es sólo velocidad
  }
  return { revisados, borrados, forgeRehecho }
}
