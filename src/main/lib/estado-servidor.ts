import { connect } from 'net'

/**
 * Si el servidor de Minecraft está en línea y cuánta gente hay, como el
 * «Jugando ahora» del launcher de Majestic.
 *
 * Es el mismo «ping» que hace la lista de servidores de Minecraft (Server List
 * Ping): un handshake pidiendo el estado y una respuesta con un JSON. No entra
 * al servidor ni necesita cuenta, y el servidor lo contesta aunque esté lleno.
 * Antes la pantalla Jugar tenía un puntito verde fijo que no consultaba nada.
 *
 * https://minecraft.wiki/w/Java_Edition_protocol/Server_List_Ping
 */

export interface EstadoServidor {
  enLinea: boolean
  jugadores: number | null
  maximo: number | null
  version: string | null
  /** Milisegundos hasta la respuesta. */
  latencia: number | null
}

export const SIN_RESPUESTA: EstadoServidor = {
  enLinea: false,
  jugadores: null,
  maximo: null,
  version: null,
  latencia: null
}

/** 1.20.1. El servidor contesta el estado aunque el número no coincida. */
const PROTOCOLO = 763

/** Una respuesta de estado nunca pesa esto; más es basura o un servidor raro. */
const MAX_PAQUETE = 1 << 20

export function escribirVarInt(valor: number): Buffer {
  const bytes: number[] = []
  let resto = valor >>> 0
  do {
    let byte = resto & 0x7f
    resto >>>= 7
    if (resto !== 0) byte |= 0x80
    bytes.push(byte)
  } while (resto !== 0)
  return Buffer.from(bytes)
}

/** `null` si los bytes no alcanzan todavía para el número entero. */
export function leerVarInt(buf: Buffer, desde = 0): { valor: number; largo: number } | null {
  let valor = 0
  for (let i = 0; i < 5; i++) {
    if (desde + i >= buf.length) return null
    const byte = buf[desde + i]
    valor |= (byte & 0x7f) << (7 * i)
    if ((byte & 0x80) === 0) return { valor: valor | 0, largo: i + 1 }
  }
  throw new Error('VarInt demasiado largo')
}

function texto(valor: string): Buffer {
  const bytes = Buffer.from(valor, 'utf8')
  return Buffer.concat([escribirVarInt(bytes.length), bytes])
}

function paquete(cuerpo: Buffer): Buffer {
  return Buffer.concat([escribirVarInt(cuerpo.length), cuerpo])
}

/** Handshake con «próximo estado: estado del servidor», y el pedido del estado. */
export function pedidoDeEstado(host: string, puerto: number): Buffer {
  const puertoBytes = Buffer.alloc(2)
  puertoBytes.writeUInt16BE(puerto)
  const handshake = paquete(
    Buffer.concat([
      escribirVarInt(0x00),
      escribirVarInt(PROTOCOLO),
      texto(host),
      puertoBytes,
      escribirVarInt(1)
    ])
  )
  const pedido = paquete(escribirVarInt(0x00))
  return Buffer.concat([handshake, pedido])
}

/**
 * El JSON de la respuesta, o `null` si todavía no llegó entera. Un servidor con
 * Forge manda la lista de mods adentro, así que suele venir en varios pedazos.
 */
export function leerRespuesta(buf: Buffer): string | null {
  const largo = leerVarInt(buf)
  if (!largo) return null
  if (largo.valor < 0 || largo.valor > MAX_PAQUETE) throw new Error('Respuesta de tamaño imposible')
  const fin = largo.largo + largo.valor
  if (buf.length < fin) return null

  const id = leerVarInt(buf, largo.largo)
  if (!id || id.valor !== 0x00) throw new Error('No es una respuesta de estado')
  const largoJson = leerVarInt(buf, largo.largo + id.largo)
  if (!largoJson) throw new Error('Respuesta cortada')
  const inicio = largo.largo + id.largo + largoJson.largo
  if (inicio + largoJson.valor > fin) throw new Error('Respuesta cortada')
  return buf.subarray(inicio, inicio + largoJson.valor).toString('utf8')
}

export function resumirEstado(json: unknown, latencia: number): EstadoServidor {
  const r = (json ?? {}) as {
    players?: { online?: unknown; max?: unknown }
    version?: { name?: unknown }
  }
  const numero = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null
  return {
    enLinea: true,
    jugadores: numero(r.players?.online),
    maximo: numero(r.players?.max),
    version: typeof r.version?.name === 'string' ? r.version.name : null,
    latencia
  }
}

/**
 * Pregunta al servidor y nunca falla: cualquier problema (sin conexión, puerto
 * cerrado, respuesta rara, se pasó el tiempo) es `SIN_RESPUESTA`.
 */
export function consultarServidor(
  host: string,
  puerto: number,
  { tiempoMs = 4000 }: { tiempoMs?: number } = {}
): Promise<EstadoServidor> {
  return new Promise((resolve) => {
    const inicio = Date.now()
    const socket = connect({ host, port: puerto })
    let recibido = Buffer.alloc(0)
    let terminado = false

    const terminar = (estado: EstadoServidor): void => {
      if (terminado) return
      terminado = true
      clearTimeout(reloj)
      socket.destroy()
      resolve(estado)
    }
    const reloj = setTimeout(() => terminar(SIN_RESPUESTA), tiempoMs)

    socket.on('connect', () => socket.write(pedidoDeEstado(host, puerto)))
    socket.on('data', (pedazo: Buffer) => {
      recibido = Buffer.concat([recibido, pedazo])
      try {
        const json = leerRespuesta(recibido)
        if (json !== null) terminar(resumirEstado(JSON.parse(json), Date.now() - inicio))
      } catch {
        terminar(SIN_RESPUESTA)
      }
    })
    socket.on('error', () => terminar(SIN_RESPUESTA))
    socket.on('close', () => terminar(SIN_RESPUESTA))
  })
}
