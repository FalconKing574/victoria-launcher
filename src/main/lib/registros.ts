import { createWriteStream, existsSync, readdirSync, renameSync, rmSync, statSync, mkdirSync, type WriteStream } from 'fs'
import { open } from 'fs/promises'
import { join } from 'path'

/**
 * Los registros que el jugador puede revisar desde Ajustes (18-10-2026).
 *
 * Cuando algo falla, el staff pide «mandá el log» y el jugador no sabe cuál ni dónde está: hay uno del
 * juego, uno de Forge, crash reports, el del launcher. Acá se juntan con un nombre que se entiende, en el
 * orden en que conviene mirarlos.
 *
 * El renderer pide un registro por su `id`, nunca por ruta: así una pantalla comprometida no puede leer
 * cualquier archivo del disco.
 */

export interface RegistroInfo {
  id: string
  nombre: string
  descripcion: string
  ruta: string
  tamano: number
  /** ms desde epoch */
  modificado: number
}

export interface RegistroContenido {
  texto: string
  /** true si el archivo era más largo y sólo se trae el final. */
  recortado: boolean
  tamano: number
}

export interface CarpetasRegistros {
  /** userData del launcher */
  datos: string
  /** la instancia del juego */
  instancia: string
  /** la raíz de Minecraft del launcher (librerías, Forge) */
  minecraft: string
}

/** Lo que el launcher guarda de cada arranque: la salida del juego y de Forge. */
export function rutaRegistroJuego(datos: string): string {
  return join(datos, 'logs', 'juego.log')
}

function masNuevo(dir: string, filtro: (nombre: string) => boolean): string | null {
  try {
    let mejor: { ruta: string; t: number } | null = null
    for (const nombre of readdirSync(dir)) {
      if (!filtro(nombre)) continue
      const ruta = join(dir, nombre)
      const t = statSync(ruta).mtimeMs
      if (!mejor || t > mejor.t) mejor = { ruta, t }
    }
    return mejor?.ruta ?? null
  } catch {
    return null
  }
}

interface Candidato {
  id: string
  nombre: string
  descripcion: string
  ruta: () => string | null
}

function candidatos(c: CarpetasRegistros): Candidato[] {
  return [
    {
      id: 'juego',
      nombre: 'Último arranque',
      descripcion: 'Todo lo que escribió el juego al iniciar, incluida la instalación de Forge. Es el primero que hay que mirar.',
      ruta: () => rutaRegistroJuego(c.datos)
    },
    {
      id: 'juego-anterior',
      nombre: 'Arranque anterior',
      descripcion: 'El mismo registro, del intento anterior.',
      ruta: () => join(c.datos, 'logs', 'juego-anterior.log')
    },
    {
      id: 'crash',
      nombre: 'Último crash report',
      descripcion: 'Lo deja Minecraft cuando se cierra por un error; dice qué mod estaba fallando.',
      ruta: () => masNuevo(join(c.instancia, 'crash-reports'), (n) => n.toLowerCase().endsWith('.txt'))
    },
    {
      id: 'latest',
      nombre: 'Minecraft (latest.log)',
      descripcion: 'El registro del juego desde que carga los mods hasta que se cierra.',
      ruta: () => join(c.instancia, 'logs', 'latest.log')
    },
    {
      id: 'debug',
      nombre: 'Minecraft detallado (debug.log)',
      descripcion: 'Lo mismo con todos los detalles. Pesado: sólo si el staff lo pide.',
      ruta: () => join(c.instancia, 'logs', 'debug.log')
    },
    {
      id: 'java',
      nombre: 'Cierre de Java',
      descripcion: 'Aparece cuando Java se cierra de golpe, casi siempre por el driver de video.',
      ruta: () => masNuevo(c.instancia, (n) => /^hs_err_pid\d+\.log$/i.test(n))
    },
    {
      id: 'forge',
      nombre: 'Instalador de Forge',
      descripcion: 'Lo escribe el instalador de Forge cuando algo le sale mal.',
      ruta: () => masNuevo(join(c.minecraft, 'forge'), (n) => n.toLowerCase().endsWith('.log'))
    },
    {
      id: 'launcher',
      nombre: 'Errores del launcher',
      descripcion: 'Fallos de la aplicación misma, no del juego.',
      ruta: () => join(c.datos, 'crash.log')
    },
    {
      id: 'conexion',
      nombre: 'Conexión del launcher',
      descripcion: 'Problemas para llegar a Microsoft, a las cuentas o a las descargas.',
      ruta: () => join(c.datos, 'conexion-launcher.log')
    }
  ]
}

/** Los registros que existen hoy, en el orden en que conviene mirarlos. */
export function listarRegistros(c: CarpetasRegistros): RegistroInfo[] {
  const out: RegistroInfo[] = []
  for (const k of candidatos(c)) {
    const ruta = k.ruta()
    if (!ruta || !existsSync(ruta)) continue
    try {
      const st = statSync(ruta)
      if (!st.isFile()) continue
      out.push({ id: k.id, nombre: k.nombre, descripcion: k.descripcion, ruta, tamano: st.size, modificado: st.mtimeMs })
    } catch {
      // se lo saltea
    }
  }
  return out
}

/** La ruta de un registro por su id, o null si no existe. */
export function rutaDeRegistro(c: CarpetasRegistros, id: string): string | null {
  const k = candidatos(c).find((x) => x.id === id)
  const ruta = k?.ruta() ?? null
  return ruta && existsSync(ruta) ? ruta : null
}

/** Cuánto se trae como máximo: el final del archivo, que es donde está el error. */
export const MAX_LECTURA = 256 * 1024

/** Lee el final de un registro sin bloquear el proceso principal. */
export async function leerFinal(ruta: string, max = MAX_LECTURA): Promise<RegistroContenido> {
  const fh = await open(ruta, 'r')
  try {
    const { size } = await fh.stat()
    const largo = Math.min(size, max)
    const buf = Buffer.alloc(largo)
    await fh.read(buf, 0, largo, size - largo)
    let texto = buf.toString('utf8')
    const recortado = size > max
    // empezar en un renglón entero
    if (recortado) texto = texto.slice(texto.indexOf('\n') + 1)
    return { texto, recortado, tamano: size }
  } finally {
    await fh.close()
  }
}

/**
 * Tapa lo que no tiene que salir de la PC si el jugador manda el registro: el token de Minecraft en los
 * argumentos y cualquier JWT suelto.
 */
export function taparSecretos(linea: string): string {
  return linea
    .replace(/(--accessToken[\s,"']+)[^\s,"']+/gi, '$1[oculto]')
    .replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]+/g, '[token oculto]')
}

/**
 * Abre el registro del arranque: el anterior pasa a `juego-anterior.log` y se empieza uno nuevo. Nunca
 * tira: si no se puede escribir, devuelve un registro que no hace nada.
 */
export function abrirRegistroJuego(datos: string): { escribir: (texto: string) => void; cerrar: () => void } {
  const ruta = rutaRegistroJuego(datos)
  let stream: WriteStream | null = null
  try {
    mkdirSync(join(datos, 'logs'), { recursive: true })
    if (existsSync(ruta)) {
      const anterior = join(datos, 'logs', 'juego-anterior.log')
      rmSync(anterior, { force: true })
      renameSync(ruta, anterior)
    }
    stream = createWriteStream(ruta, { flags: 'w' })
    stream.on('error', () => {
      stream = null
    })
  } catch {
    stream = null
  }
  return {
    escribir: (texto) => {
      if (!stream) return
      const limpio = taparSecretos(texto)
      stream.write(limpio.endsWith('\n') ? limpio : `${limpio}\n`)
    },
    cerrar: () => {
      stream?.end()
      stream = null
    }
  }
}
