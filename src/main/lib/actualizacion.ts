import { existsSync, readFileSync, rmSync } from 'fs'
import { writeJsonAtomic } from './write-atomic'

/**
 * Lo que el actualizador del launcher necesita recordar entre una apertura y
 * la siguiente, aparte de Electron para poder probarlo.
 *
 * El problema que resuelve: para instalar una versión nueva el launcher abre el
 * instalador y se cierra. Si el antivirus bloquea ese instalador, no se instala
 * nada y tampoco queda nadie para avisarlo. El jugador vuelve a abrir el
 * launcher, la actualización ya está descargada, se intenta instalar otra vez y
 * el launcher se vuelve a cerrar: queda inutilizable, cerrándose solo a los
 * pocos segundos de cada apertura.
 *
 * Por eso cada intento se anota antes de cerrar. Si al volver a abrir la versión
 * sigue siendo la vieja, el intento falló. Después de `MAX_INTENTOS_AUTOMATICOS`
 * fallos con la misma versión se deja de instalar sola y se le explica al
 * jugador qué pasa, sin impedirle jugar.
 */

/** Cuántas veces se instala sola una misma versión antes de darla por bloqueada. */
export const MAX_INTENTOS_AUTOMATICOS = 2

export interface IntentoActualizacion {
  /** La versión que se intentó instalar. */
  version: string
  /** La que estaba instalada cuando se intentó. */
  desde: string
  /** Cuántas veces se abrió el instalador para esta versión. */
  intentos: number
  /** Fecha del último intento (ISO). */
  ultimo: string
}

export type ResultadoIntento =
  | { estado: 'nada' }
  | { estado: 'instalada'; version: string }
  | { estado: 'fallida'; version: string; intentos: number; bloqueada: boolean }

/**
 * Compara dos versiones `x.y.z`. Ignora sufijos (`-beta.1`) y trata lo que falta
 * como 0, que alcanza para las versiones que publica este launcher.
 */
export function compararVersiones(a: string, b: string): number {
  const partes = (v: string): number[] =>
    v
      .trim()
      .replace(/^v/i, '')
      .split(/[-+]/)[0]
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0)
  const pa = partes(a)
  const pb = partes(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diferencia = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diferencia !== 0) return diferencia > 0 ? 1 : -1
  }
  return 0
}

/** El registro después de abrir el instalador de `version` una vez más. */
export function registrarIntento(
  previo: IntentoActualizacion | null,
  version: string,
  desde: string,
  ahora: Date
): IntentoActualizacion {
  const mismo = previo !== null && compararVersiones(previo.version, version) === 0
  return {
    version,
    desde,
    intentos: mismo ? previo.intentos + 1 : 1,
    ultimo: ahora.toISOString()
  }
}

/** Al arrancar: qué pasó con el último instalador que se abrió. */
export function evaluarIntento(
  intento: IntentoActualizacion | null,
  versionActual: string
): ResultadoIntento {
  if (!intento) return { estado: 'nada' }
  if (compararVersiones(versionActual, intento.version) >= 0) {
    return { estado: 'instalada', version: intento.version }
  }
  return {
    estado: 'fallida',
    version: intento.version,
    intentos: intento.intentos,
    bloqueada: intento.intentos >= MAX_INTENTOS_AUTOMATICOS
  }
}

function esIntento(valor: unknown): valor is IntentoActualizacion {
  if (typeof valor !== 'object' || valor === null) return false
  const v = valor as Record<string, unknown>
  return (
    typeof v.version === 'string' &&
    typeof v.desde === 'string' &&
    typeof v.intentos === 'number' &&
    Number.isFinite(v.intentos) &&
    typeof v.ultimo === 'string'
  )
}

/**
 * Lee el registro. Uno roto o ilegible cuenta como que no hay: en el peor caso
 * se vuelve a intentar instalar una vez, que es lo mismo que pasaba antes.
 */
export function leerIntento(ruta: string): IntentoActualizacion | null {
  try {
    if (!existsSync(ruta)) return null
    const valor: unknown = JSON.parse(readFileSync(ruta, 'utf8'))
    return esIntento(valor) ? valor : null
  } catch {
    return null
  }
}

export function guardarIntento(ruta: string, intento: IntentoActualizacion): void {
  writeJsonAtomic(ruta, intento)
}

export function borrarIntento(ruta: string): void {
  rmSync(ruta, { force: true })
}

/**
 * El instalador completo de una versión, para bajarlo con el navegador cuando el
 * automático no se puede abrir. Es el mismo archivo que baja el actualizador
 * (`latest.yml` lo nombra); abierto a mano muestra el asistente de siempre.
 */
export function urlDescargaManual(repo: string, version: string, archivo: string): string {
  return `https://github.com/${repo}/releases/download/v${version}/${encodeURIComponent(archivo)}`
}

export interface DiagnosticoError {
  /** Lo que se le muestra al jugador. */
  mensaje: string
  /** Si parece el antivirus: entonces se le explica qué hacer y cómo saltarlo. */
  antivirus: boolean
}

/**
 * Pasa un error de electron-updater a algo que un jugador pueda leer.
 *
 * Lo que llegaba a la pantalla era el texto crudo de la librería —«sha512
 * checksum mismatch», «ENOENT: no such file or directory, rename ...»— que no
 * dice qué pasó ni qué hacer. Casi siempre es una de tres cosas: sin conexión,
 * el antivirus tocando el archivo descargado, o GitHub sin la versión.
 */
export function diagnosticarErrorActualizacion(error: unknown): DiagnosticoError {
  const crudo = error instanceof Error ? error.message : String(error ?? '')
  const texto = crudo.toLowerCase()

  if (/sha512 checksum mismatch|checksum mismatch/.test(texto)) {
    return {
      mensaje:
        'La actualización llegó dañada o el antivirus la modificó al descargarla. ' +
        'Se volverá a descargar la próxima vez que abras el launcher.',
      antivirus: true
    }
  }
  if (
    /\b(enoent|eperm|eacces|ebusy)\b|operation not permitted|access is denied|acceso denegado/.test(
      texto
    )
  ) {
    return {
      mensaje:
        'El antivirus bloqueó o se llevó el archivo de la actualización. Puedes seguir ' +
        'jugando con esta versión.',
      antivirus: true
    }
  }
  if (
    /net::err_|enotfound|eai_again|etimedout|econnreset|econnrefused|enetunreach|socket hang up|network/.test(
      texto
    )
  ) {
    return {
      mensaje:
        'No se pudo conectar con GitHub para buscar actualizaciones. Puedes jugar igual; ' +
        'se volverá a buscar al abrir el launcher.',
      antivirus: false
    }
  }
  if (/\b404\b|cannot find latest\.yml|not found/.test(texto)) {
    return {
      mensaje:
        'No se encontró la versión publicada del launcher. Puedes jugar igual; se volverá ' +
        'a buscar al abrir el launcher.',
      antivirus: false
    }
  }
  if (/rate limit|\b403\b|\b429\b/.test(texto)) {
    return {
      mensaje: 'GitHub limitó las consultas por un rato. Se volverá a buscar al abrir el launcher.',
      antivirus: false
    }
  }

  const primeraLinea = crudo.split('\n')[0].trim()
  if (!primeraLinea)
    return { mensaje: 'No se pudo actualizar el launcher. Puedes jugar igual.', antivirus: false }
  const corta = primeraLinea.length > 160 ? `${primeraLinea.slice(0, 157)}...` : primeraLinea
  return {
    mensaje: `No se pudo actualizar el launcher (${corta}). Puedes jugar igual.`,
    antivirus: false
  }
}
