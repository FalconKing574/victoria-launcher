/**
 * El ping de la lista de servidores de Minecraft (Server List Ping), para la web.
 *
 * Es la misma lógica que `src/main/lib/estado-servidor.ts` del launcher, con
 * `Uint8Array` en vez del `Buffer` de Node, que en Cloudflare no existe. La
 * función que abre la conexión TCP (`connect` de `cloudflare:sockets`) la pasa
 * `functions/api/estado.js`, así que todo esto se puede probar sin Cloudflare
 * (`tests/web-ping.test.ts`).
 *
 * https://minecraft.wiki/w/Java_Edition_protocol/Server_List_Ping
 */

export interface EstadoServidor {
  enLinea: boolean
  jugadores: number | null
  maximo: number | null
  version: string | null
}

export const SIN_RESPUESTA: EstadoServidor = {
  enLinea: false,
  jugadores: null,
  maximo: null,
  version: null
}

/** 1.20.1. El servidor contesta el estado aunque el número no coincida. */
const PROTOCOLO = 763

/** Una respuesta de estado nunca pesa esto; más es basura. */
const MAX_PAQUETE = 1 << 20

export function escribirVarInt(valor: number): number[] {
  const bytes: number[] = []
  let resto = valor >>> 0
  do {
    let byte = resto & 0x7f
    resto >>>= 7
    if (resto !== 0) byte |= 0x80
    bytes.push(byte)
  } while (resto !== 0)
  return bytes
}

/** `null` si los bytes no alcanzan todavía para el número entero. */
export function leerVarInt(bytes: Uint8Array, desde = 0): { valor: number; largo: number } | null {
  let valor = 0
  for (let i = 0; i < 5; i++) {
    if (desde + i >= bytes.length) return null
    const byte = bytes[desde + i]
    valor |= (byte & 0x7f) << (7 * i)
    if ((byte & 0x80) === 0) return { valor: valor | 0, largo: i + 1 }
  }
  throw new Error('VarInt demasiado largo')
}

function paquete(cuerpo: number[]): number[] {
  return [...escribirVarInt(cuerpo.length), ...cuerpo]
}

/** Handshake con «próximo estado: estado del servidor», y el pedido del estado. */
export function pedidoDeEstado(host: string, puerto: number): Uint8Array {
  const hostBytes = [...new TextEncoder().encode(host)]
  const handshake = paquete([
    ...escribirVarInt(0x00),
    ...escribirVarInt(PROTOCOLO),
    ...escribirVarInt(hostBytes.length),
    ...hostBytes,
    (puerto >> 8) & 0xff,
    puerto & 0xff,
    ...escribirVarInt(1)
  ])
  return Uint8Array.from([...handshake, ...paquete(escribirVarInt(0x00))])
}

/** El JSON de la respuesta, o `null` si todavía no llegó entera. */
export function leerRespuesta(bytes: Uint8Array): string | null {
  const largo = leerVarInt(bytes)
  if (!largo) return null
  if (largo.valor < 0 || largo.valor > MAX_PAQUETE) throw new Error('Respuesta de tamaño imposible')
  const fin = largo.largo + largo.valor
  if (bytes.length < fin) return null

  const id = leerVarInt(bytes, largo.largo)
  if (!id || id.valor !== 0x00) throw new Error('No es una respuesta de estado')
  const largoJson = leerVarInt(bytes, largo.largo + id.largo)
  if (!largoJson) throw new Error('Respuesta cortada')
  const inicio = largo.largo + id.largo + largoJson.largo
  if (inicio + largoJson.valor > fin) throw new Error('Respuesta cortada')
  return new TextDecoder().decode(bytes.subarray(inicio, inicio + largoJson.valor))
}

export function resumirEstado(json: unknown): EstadoServidor {
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
    version: typeof r.version?.name === 'string' ? r.version.name : null
  }
}

export function concatenar(a: Uint8Array, b: Uint8Array): Uint8Array {
  const junto = new Uint8Array(a.length + b.length)
  junto.set(a)
  junto.set(b, a.length)
  return junto
}

/** Lo que hace falta de un socket de `cloudflare:sockets`. */
export interface Socket {
  readable: ReadableStream<Uint8Array>
  writable: WritableStream<Uint8Array>
  close(): unknown
}

export type Conectar = (destino: { hostname: string; port: number }) => Socket

/**
 * Hace el ping y nunca falla: cualquier problema es {@link SIN_RESPUESTA}.
 *
 * El tiempo límite cubre TODO, conexión incluida. Con la máquina apagada o la
 * red cortada, conectar no falla: se queda esperando, y sin este límite la
 * página esperaba con él (más de 40 s en la prueba).
 */
export async function consultarEstado(
  conectar: Conectar,
  host: string,
  puerto: number,
  tiempoMs: number
): Promise<EstadoServidor> {
  let socket: Socket | undefined
  let temporizador: ReturnType<typeof setTimeout> | undefined
  const ping = (async (): Promise<EstadoServidor> => {
    socket = conectar({ hostname: host, port: puerto })
    const escritor = socket.writable.getWriter()
    await escritor.write(pedidoDeEstado(host, puerto))
    escritor.releaseLock()

    const lector = socket.readable.getReader()
    let recibido: Uint8Array = new Uint8Array(0)
    for (;;) {
      const { value, done } = await lector.read()
      if (done || !value) return SIN_RESPUESTA
      recibido = concatenar(recibido, value)
      const json = leerRespuesta(recibido)
      if (json !== null) return resumirEstado(JSON.parse(json))
    }
  })().catch(() => SIN_RESPUESTA)
  const limite = new Promise<EstadoServidor>((listo) => {
    temporizador = setTimeout(() => listo(SIN_RESPUESTA), tiempoMs)
  })

  try {
    return await Promise.race([ping, limite])
  } finally {
    clearTimeout(temporizador)
    try {
      socket?.close()
    } catch {
      // Ya estaba cerrado.
    }
  }
}
