import { describe, it, expect } from 'vitest'
import {
  SIN_RESPUESTA,
  concatenar,
  consultarEstado,
  escribirVarInt,
  leerRespuesta,
  leerVarInt,
  pedidoDeEstado,
  resumirEstado,
  type Socket
} from '../web/lib/ping'
import {
  escribirVarInt as varIntLauncher,
  pedidoDeEstado as pedidoLauncher
} from '../src/main/lib/estado-servidor'

/**
 * Qué protege esto.
 *
 * La web muestra si el servidor está en línea con el mismo ping que el launcher,
 * reescrito sin el `Buffer` de Node (en Cloudflare no existe). Las dos copias
 * tienen que decir lo mismo: si una cambia y la otra no, la web y el launcher
 * mostrarían cosas distintas.
 */

function respuesta(json: object): Uint8Array {
  const texto = [...new TextEncoder().encode(JSON.stringify(json))]
  const cuerpo = [...escribirVarInt(0x00), ...escribirVarInt(texto.length), ...texto]
  return Uint8Array.from([...escribirVarInt(cuerpo.length), ...cuerpo])
}

describe('ping de la web', () => {
  it('arma exactamente el mismo pedido que el launcher', () => {
    expect([...pedidoDeEstado('131.221.32.76', 25567)]).toEqual([
      ...pedidoLauncher('131.221.32.76', 25567)
    ])
  })

  it('los mismos VarInt que el launcher', () => {
    for (const n of [0, 1, 127, 128, 300, 25565, 2147483647, -1]) {
      expect(escribirVarInt(n)).toEqual([...varIntLauncher(n)])
      expect(leerVarInt(Uint8Array.from(escribirVarInt(n)))?.valor).toBe(n)
    }
  })

  it('espera la respuesta entera aunque llegue en pedazos', () => {
    const entera = respuesta({ players: { online: 7, max: 120 }, version: { name: '1.20.1' } })
    let recibido: Uint8Array = new Uint8Array(0)
    let json: string | null = null
    for (let i = 0; i < entera.length; i += 5) {
      recibido = concatenar(recibido, entera.subarray(i, i + 5))
      json = leerRespuesta(recibido)
      if (i + 5 < entera.length) expect(json).toBeNull()
    }
    expect(resumirEstado(JSON.parse(json!))).toEqual({
      enLinea: true,
      jugadores: 7,
      maximo: 120,
      version: '1.20.1'
    })
  })

  it('algo que no es una respuesta de estado es un error, nunca «en línea»', () => {
    expect(() => leerRespuesta(Uint8Array.from([2, 0x01, 0]))).toThrow()
  })
})

/** Un socket de mentira: contesta lo que se le pase, en pedazos, o nunca. */
function socketFalso(pedazos: Uint8Array[] | 'nunca'): Socket & { cerrado: boolean } {
  const falso = {
    cerrado: false,
    writable: new WritableStream<Uint8Array>(),
    readable: new ReadableStream<Uint8Array>({
      start(control) {
        if (pedazos === 'nunca') return
        for (const p of pedazos) control.enqueue(p)
        control.close()
      }
    }),
    close() {
      falso.cerrado = true
    }
  }
  return falso
}

describe('consultarEstado (lo que corre en Cloudflare)', () => {
  it('lee el estado aunque llegue en pedazos, y cierra la conexión', async () => {
    const entera = respuesta({ players: { online: 23, max: 120 }, version: { name: '1.20.1' } })
    const socket = socketFalso([entera.subarray(0, 4), entera.subarray(4)])
    const estado = await consultarEstado(() => socket, '131.221.32.76', 25567, 1000)
    expect(estado).toEqual({ enLinea: true, jugadores: 23, maximo: 120, version: '1.20.1' })
    expect(socket.cerrado).toBe(true)
  })

  // El caso que colgaba la web más de 40 s: la máquina apagada no rechaza la
  // conexión, no contesta nunca.
  it('si el servidor no contesta, «sin respuesta» al vencer el tiempo y no después', async () => {
    const socket = socketFalso('nunca')
    const antes = Date.now()
    const estado = await consultarEstado(() => socket, '131.221.32.76', 25567, 80)
    expect(estado).toEqual(SIN_RESPUESTA)
    expect(Date.now() - antes).toBeLessThan(1000)
    expect(socket.cerrado).toBe(true)
  })

  it('si no se puede ni conectar, «sin respuesta»', async () => {
    const estado = await consultarEstado(
      () => {
        throw new Error('conexión rechazada')
      },
      '131.221.32.76',
      25567,
      1000
    )
    expect(estado).toEqual(SIN_RESPUESTA)
  })

  it('si la conexión se corta antes de la respuesta entera, «sin respuesta»', async () => {
    const entera = respuesta({ players: { online: 1, max: 2 } })
    const estado = await consultarEstado(() => socketFalso([entera.subarray(0, 6)]), 'x', 1, 1000)
    expect(estado).toEqual(SIN_RESPUESTA)
  })
})
