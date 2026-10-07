import { describe, it, expect, afterEach } from 'vitest'
import { createServer, type AddressInfo, type Server, type Socket } from 'net'
import {
  SIN_RESPUESTA,
  consultarServidor,
  escribirVarInt,
  leerRespuesta,
  leerVarInt,
  pedidoDeEstado,
  resumirEstado
} from '../src/main/lib/estado-servidor'

/**
 * Qué protege esto.
 *
 * La pantalla Jugar dice si el servidor está en línea y cuánta gente hay. Lo
 * que no puede pasar es que diga «en línea» sin haber hablado con el servidor
 * (lo que hacía el puntito verde fijo de antes), ni que una respuesta rara o un
 * servidor que no contesta cuelgue la pantalla: todo eso es «no responde».
 *
 * Se prueba contra un servidor TCP de verdad que habla el protocolo de estado,
 * en esta misma máquina.
 */

/** Arma la respuesta de estado como la manda Minecraft. */
function respuesta(json: object): Buffer {
  const texto = Buffer.from(JSON.stringify(json), 'utf8')
  const cuerpo = Buffer.concat([escribirVarInt(0x00), escribirVarInt(texto.length), texto])
  return Buffer.concat([escribirVarInt(cuerpo.length), cuerpo])
}

const ESTADO_FORGE = {
  version: { name: '1.20.1', protocol: 763 },
  players: { max: 120, online: 23, sample: [{ name: 'Aldeano', id: '0' }] },
  description: { text: '§6Victoria Kingdom' },
  // Forge manda la lista de mods: es lo que hace que la respuesta sea grande.
  forgeData: { channels: [], mods: [], fmlNetworkVersion: 3, d: 'x'.repeat(40_000) }
}

let servidor: Server | null = null

afterEach(async () => {
  await new Promise<void>((listo) => (servidor ? servidor.close(() => listo()) : listo()))
  servidor = null
})

async function servidorFalso(
  alConectar: (socket: Socket, pedido: Buffer[]) => void
): Promise<number> {
  servidor = createServer((socket) => {
    const pedido: Buffer[] = []
    socket.on('data', (d) => {
      pedido.push(d)
      alConectar(socket, pedido)
    })
    socket.on('error', () => undefined)
  })
  await new Promise<void>((listo) => servidor!.listen(0, '127.0.0.1', () => listo()))
  return (servidor!.address() as AddressInfo).port
}

describe('VarInt', () => {
  it('los valores de referencia del protocolo', () => {
    expect([...escribirVarInt(0)]).toEqual([0x00])
    expect([...escribirVarInt(127)]).toEqual([0x7f])
    expect([...escribirVarInt(128)]).toEqual([0x80, 0x01])
    expect([...escribirVarInt(300)]).toEqual([0xac, 0x02])
    expect([...escribirVarInt(25565)]).toEqual([0xdd, 0xc7, 0x01])
    expect([...escribirVarInt(-1)]).toEqual([0xff, 0xff, 0xff, 0xff, 0x0f])
  })

  it('ida y vuelta', () => {
    for (const n of [0, 1, 127, 128, 255, 25567, 2097151, 2147483647, -1]) {
      expect(leerVarInt(escribirVarInt(n))).toEqual({ valor: n, largo: escribirVarInt(n).length })
    }
  })

  it('a medias, avisa que faltan bytes en vez de inventar un número', () => {
    expect(leerVarInt(Buffer.from([0xdd, 0xc7]))).toBeNull()
    expect(leerVarInt(Buffer.alloc(0))).toBeNull()
  })
})

describe('el pedido', () => {
  it('handshake con la dirección y el puerto, y después el pedido de estado', () => {
    const pedido = pedidoDeEstado('131.221.32.76', 25567)
    const largo = leerVarInt(pedido)!
    const handshake = pedido.subarray(largo.largo, largo.largo + largo.valor)
    expect(handshake[0]).toBe(0x00) // id del handshake
    expect(handshake.includes(Buffer.from('131.221.32.76'))).toBe(true)
    expect(handshake.readUInt16BE(handshake.length - 3)).toBe(25567)
    expect(handshake[handshake.length - 1]).toBe(1) // «próximo estado: estado»
    expect([...pedido.subarray(largo.largo + largo.valor)]).toEqual([0x01, 0x00])
  })
})

describe('leerRespuesta', () => {
  it('espera a que llegue entera', () => {
    const entera = respuesta(ESTADO_FORGE)
    expect(leerRespuesta(entera.subarray(0, 100))).toBeNull()
    expect(JSON.parse(leerRespuesta(entera)!).players.online).toBe(23)
  })

  it('un paquete que no es de estado es un error, no un «en línea»', () => {
    const otro = Buffer.concat([escribirVarInt(2), escribirVarInt(0x01), escribirVarInt(0)])
    expect(() => leerRespuesta(otro)).toThrow()
  })
})

describe('resumirEstado', () => {
  it('jugadores, máximo y versión', () => {
    expect(resumirEstado(ESTADO_FORGE, 80)).toEqual({
      enLinea: true,
      jugadores: 23,
      maximo: 120,
      version: '1.20.1',
      latencia: 80
    })
  })

  it('un servidor que esconde los jugadores sigue en línea, sin número', () => {
    const estado = resumirEstado({ version: { name: 'x' } }, 10)
    expect(estado.enLinea).toBe(true)
    expect(estado.jugadores).toBeNull()
  })
})

describe('consultarServidor', () => {
  it('habla con un servidor de verdad y trae el estado', async () => {
    const puerto = await servidorFalso((socket, pedido) => {
      if (Buffer.concat(pedido).length >= pedidoDeEstado('127.0.0.1', 1).length - 1) {
        socket.write(respuesta(ESTADO_FORGE))
      }
    })
    const estado = await consultarServidor('127.0.0.1', puerto)
    expect(estado.enLinea).toBe(true)
    expect(estado.jugadores).toBe(23)
    expect(estado.latencia).toBeGreaterThanOrEqual(0)
  })

  it('la respuesta grande de Forge llega en pedazos y se arma igual', async () => {
    const puerto = await servidorFalso((socket, pedido) => {
      if (pedido.length > 1) return
      const todo = respuesta(ESTADO_FORGE)
      let desde = 0
      const mandar = (): void => {
        if (desde >= todo.length) return
        socket.write(todo.subarray(desde, desde + 1000))
        desde += 1000
        setTimeout(mandar, 1)
      }
      mandar()
    })
    const estado = await consultarServidor('127.0.0.1', puerto)
    expect(estado.jugadores).toBe(23)
  })

  it('puerto cerrado: no responde, sin colgarse', async () => {
    const puerto = await servidorFalso(() => undefined)
    await new Promise<void>((listo) => servidor!.close(() => listo()))
    servidor = null
    expect(await consultarServidor('127.0.0.1', puerto, { tiempoMs: 2000 })).toEqual(SIN_RESPUESTA)
  })

  it('un servidor que acepta y no contesta: se corta a tiempo', async () => {
    const puerto = await servidorFalso(() => undefined)
    const inicio = Date.now()
    expect(await consultarServidor('127.0.0.1', puerto, { tiempoMs: 300 })).toEqual(SIN_RESPUESTA)
    expect(Date.now() - inicio).toBeLessThan(2000)
  })

  it('basura en vez de una respuesta: no responde, no «en línea»', async () => {
    const puerto = await servidorFalso((socket) => {
      socket.write(Buffer.from('HTTP/1.1 400 Bad Request\r\n\r\n'))
    })
    expect(await consultarServidor('127.0.0.1', puerto, { tiempoMs: 1000 })).toEqual(SIN_RESPUESTA)
  })
})
