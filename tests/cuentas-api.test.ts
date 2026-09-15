import { describe, it, expect } from 'vitest'
import { constants, createDecipheriv, generateKeyPairSync, privateDecrypt } from 'crypto'
import { cerrarConClave } from '../src/main/lib/sobre'
import { llamar, ServidorCaido, type AuthManifest } from '../src/main/lib/cuentas-api'

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 3072 })
const auth: AuthManifest = {
  host: '127.0.0.1',
  puerto: 25568,
  llave: publicKey.export({ type: 'spki', format: 'der' }).toString('base64')
}

function abrir(texto: string): { clave: Buffer; cuerpo: Record<string, unknown> } {
  const s = JSON.parse(texto) as { k: string; n: string; c: string }
  const clave = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(s.k, 'base64')
  )
  const todo = Buffer.from(s.c, 'base64')
  const d = createDecipheriv('aes-256-gcm', clave, Buffer.from(s.n, 'base64'))
  d.setAuthTag(todo.subarray(todo.length - 16))
  const claro = Buffer.concat([d.update(todo.subarray(0, todo.length - 16)), d.final()])
  return { clave, cuerpo: JSON.parse(claro.toString('utf8')) as Record<string, unknown> }
}

/** Un servidor de cuentas de mentira que habla por `fetch`. */
function servidorFalso(opciones: { desafioCaido?: boolean; sobreStatus?: number } = {}) {
  const recibidos: Record<string, unknown>[] = []
  const fetcher = (async (url: string, init?: RequestInit) => {
    if (url.endsWith('/v1/desafio')) {
      if (opciones.desafioCaido) throw new Error('ECONNREFUSED')
      return new Response(JSON.stringify({ desafio: 'd-123' }), { status: 200 })
    }
    if (url.endsWith('/v2/sobre')) {
      if (opciones.sobreStatus) return new Response('{}', { status: opciones.sobreStatus })
      const { clave, cuerpo } = abrir(String(init?.body))
      recibidos.push(cuerpo)
      return new Response(cerrarConClave(clave, { ok: true, eco: cuerpo.op }), { status: 200 })
    }
    return new Response('', { status: 404 })
  }) as unknown as typeof fetch
  return { fetcher, recibidos }
}

describe('cuentas-api', () => {
  it('manda la operación y el desafío adentro del sobre y abre la respuesta', async () => {
    const s = servidorFalso()
    const r = await llamar(auth, 'entrar', { nombre: 'Juan', contrasena: 'x' }, s.fetcher)
    expect(r).toEqual({ ok: true, eco: 'entrar' })
    expect(s.recibidos[0]).toEqual({ nombre: 'Juan', contrasena: 'x', op: 'entrar', desafio: 'd-123' })
  })

  it('servidor apagado es ServidorCaido', async () => {
    const s = servidorFalso({ desafioCaido: true })
    await expect(llamar(auth, 'cuenta', {}, s.fetcher)).rejects.toBeInstanceOf(ServidorCaido)
  })

  it('un 400 (llave vieja en el manifiesto) es ServidorCaido', async () => {
    const s = servidorFalso({ sobreStatus: 400 })
    await expect(llamar(auth, 'cuenta', {}, s.fetcher)).rejects.toBeInstanceOf(ServidorCaido)
  })

  it('un servidor que no contesta corta por tiempo', async () => {
    const colgado = (() => new Promise(() => undefined)) as unknown as typeof fetch
    await expect(llamar(auth, 'cuenta', {}, colgado, 50)).rejects.toBeInstanceOf(ServidorCaido)
  })
})
