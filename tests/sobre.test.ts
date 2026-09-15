import { describe, it, expect } from 'vitest'
import { constants, createDecipheriv, generateKeyPairSync, privateDecrypt, randomBytes } from 'crypto'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { abrirRespuesta, cerrarConClave, cerrarPedido } from '../src/main/lib/sobre'

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072 })
const publica = publicKey.export({ type: 'spki', format: 'der' }).toString('base64')

/** Lo que hace el plugin con el pedido, escrito en Node para poder probarlo acá. */
function abrirComoServidor(texto: string): { clave: Buffer; cuerpo: unknown } {
  const s = JSON.parse(texto) as { k: string; n: string; c: string }
  const clave = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(s.k, 'base64')
  )
  const todo = Buffer.from(s.c, 'base64')
  const d = createDecipheriv('aes-256-gcm', clave, Buffer.from(s.n, 'base64'))
  d.setAuthTag(todo.subarray(todo.length - 16))
  const claro = Buffer.concat([d.update(todo.subarray(0, todo.length - 16)), d.final()])
  return { clave, cuerpo: JSON.parse(claro.toString('utf8')) }
}

describe('sobre', () => {
  it('cierra un pedido que el servidor abre, aunque no entre en RSA', () => {
    const cuerpo = { op: 'premium', mcToken: 'x'.repeat(1500), desafio: 'd1' }
    const { texto, clave } = cerrarPedido(publica, cuerpo)
    const abierto = abrirComoServidor(texto)
    expect(abierto.cuerpo).toEqual(cuerpo)
    expect(abierto.clave.equals(clave)).toBe(true)
  })

  it('abre la respuesta cerrada con la misma clave', () => {
    const clave = randomBytes(32)
    const respuesta = { ok: true, sesion: 'token-de-30-dias' }
    const texto = cerrarConClave(clave, respuesta)
    expect(texto).not.toContain('token-de-30-dias')
    expect(abrirRespuesta(clave, texto)).toEqual(respuesta)
  })

  it('una respuesta tocada no abre', () => {
    const clave = randomBytes(32)
    const s = JSON.parse(cerrarConClave(clave, { ok: true })) as { n: string; c: string }
    const c = Buffer.from(s.c, 'base64')
    c[0] ^= 0xff
    expect(() => abrirRespuesta(clave, JSON.stringify({ n: s.n, c: c.toString('base64') }))).toThrow()
  })

  it.runIf(process.env.VICTORIA_VECTOR === '1')('escribe el vector para el plugin', () => {
    const esperado = { op: 'registrar', nombre: 'Juan', correo: 'juan@gmail.com', desafio: 'd', n: 3 }
    const { texto, clave } = cerrarPedido(publica, esperado)
    const respuestaEsperada = { ok: true, mensaje: 'Código ñandú' }
    const vector = {
      privada: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
      pedido: texto,
      esperado,
      respuesta: cerrarConClave(clave, respuestaEsperada),
      respuestaEsperada
    }
    const destino = join(
      __dirname,
      '..',
      '..',
      'VictoriaRP',
      'plugins-src',
      'VictoriaAuth',
      'test',
      'vector-sobre.json'
    )
    writeFileSync(destino, JSON.stringify(vector, null, 2), 'utf8')
  })
})
