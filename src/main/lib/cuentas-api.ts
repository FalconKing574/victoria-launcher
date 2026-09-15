import { abrirRespuesta, cerrarPedido } from './sobre'

/**
 * El cliente del servidor de cuentas de Victoria (plugin VictoriaAuth).
 *
 * ```
 * launcher --GET  /v1/desafio--------------------------> VictoriaAuth
 *          --POST /v2/sobre {op, desafio, ...} cifrado-->
 *          <------------- respuesta cifrada con la misma clave
 * ```
 *
 * Todas las operaciones van por la misma ruta a propósito: quien mira el cable
 * no sabe si alguien se registra, entra o pide un vale.
 *
 * ## Por qué HTTP y no HTTPS
 *
 * No hay dominio para un certificado. El sobre va cifrado hacia la llave pública
 * del servidor, que sale del manifiesto (ver `lib/sobre.ts`). No es TLS y no hay
 * que decir que lo es.
 */

/** Lo que el manifiesto dice del servidor de cuentas. */
export interface AuthManifest {
  /** Dónde escucha el plugin. Normalmente la misma IP del servidor. */
  host: string
  /** El puerto de la allocation, que no es el del juego. */
  puerto: number
  /** La llave pública del servidor, DER/SPKI en base64. */
  llave: string
  /** Para vincular Discord. El client id es público; el secret vive en el servidor. */
  discord?: { clientId: string; puerto: number }
}

export type Paso = 'discord' | 'normas' | 'tutorial'

export interface EstadoCuenta {
  nombre: string
  tipo: 'PREMIUM' | 'NO_PREMIUM'
  discord?: string
  correo?: string
  pasos: Paso[]
}

export interface SancionInfo {
  /** false: la sanción es de otra cuenta con la que se comparte IP o equipo. */
  propia: boolean
  mensaje: string
  motivo?: string
  desde?: number
  hasta?: number
  permanente?: boolean
}

export interface Respuesta {
  ok: boolean
  error?: string
  mensaje?: string
  cuenta?: EstadoCuenta
  /** Sólo lo ve el proceso main: `ipc/cuentas.ts` lo guarda y lo saca. */
  sesion?: string
  paso?: 'codigo'
  correo?: string
  vale?: string
  nombre?: string
  pasos?: Paso[]
  sancion?: SancionInfo
}

export class ServidorCaido extends Error {
  constructor() {
    super('El servidor de Victoria no responde. Probá de nuevo en un rato.')
    this.name = 'ServidorCaido'
  }
}

/**
 * Cuánto se espera la respuesta. 15 s y no 6: registrar le pregunta a Mojang y
 * vincular Discord hace dos llamadas a Discord, del lado del servidor.
 */
const ESPERA_MS = 15_000

export async function llamar(
  auth: AuthManifest,
  op: string,
  datos: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
  esperaMs = ESPERA_MS
): Promise<Respuesta> {
  const base = `http://${auth.host}:${auth.puerto}`
  try {
    const d = await conTiempo(fetcher(`${base}/v1/desafio`, { cache: 'no-store' }), esperaMs)
    if (!d.ok) throw new ServidorCaido()
    const { desafio } = (await d.json()) as { desafio?: string }
    if (!desafio) throw new ServidorCaido()

    const { texto, clave } = cerrarPedido(auth.llave, { ...datos, op, desafio })
    const r = await conTiempo(
      fetcher(`${base}/v2/sobre`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: texto
      }),
      esperaMs
    )
    // 400 es "el sobre no abrió": casi siempre una llave vieja en el manifiesto.
    // Para el jugador es lo mismo que un servidor caído; el log lo dice.
    if (r.status !== 200) {
      console.error(`[cuentas] el servidor contestó ${r.status} a '${op}'`)
      throw new ServidorCaido()
    }
    return abrirRespuesta<Respuesta>(clave, await r.text())
  } catch (e) {
    if (!(e instanceof ServidorCaido)) {
      console.error(`[cuentas] '${op}' falló:`, (e as Error).message)
    }
    throw new ServidorCaido()
  }
}

async function conTiempo<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let reloj: NodeJS.Timeout | undefined
  const limite = new Promise<never>((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error('sin respuesta')), ms)
  })
  try {
    return await Promise.race([promesa, limite])
  } finally {
    clearTimeout(reloj)
  }
}
