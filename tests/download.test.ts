import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHash } from 'crypto'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

import { downloadVerified } from '../src/main/lib/download'

/**
 * Qué protege esto.
 *
 * `downloadVerified` es lo único que garantiza que lo que termina en la carpeta
 * del jugador es lo que el manifiesto dice que tiene que estar. Si dejara pasar
 * un archivo con el hash equivocado, el launcher instalaría en la máquina de
 * cada uno lo que sea que haya respondido el servidor — un jar a medio bajar, o
 * el cuerpo de un error de un proxy.
 *
 * Por eso los casos de acá son los del archivo que llega mal, no los del que
 * llega bien.
 */

const cuerpo = (texto: string): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(texto))
      controller.close()
    }
  })

const sha1 = (texto: string): string => createHash('sha1').update(texto).digest('hex')

/** Una respuesta como la que devuelve fetch, con el cuerpo pedido. */
const respuesta = (texto: string, init: { ok?: boolean; status?: number } = {}): Response =>
  ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    body: cuerpo(texto),
    headers: new Headers({ 'content-length': String(texto.length) })
  }) as unknown as Response

describe('downloadVerified', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'victoria-download-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    vi.unstubAllGlobals()
  })

  it('guarda el archivo cuando el hash coincide', async () => {
    const contenido = 'un jar de mentira'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(contenido)))
    const destino = join(dir, 'mod.jar')

    await downloadVerified('https://ejemplo/mod.jar', destino, {
      expected: sha1(contenido),
      algo: 'sha1',
      label: 'mod.jar'
    })

    expect(readFileSync(destino, 'utf8')).toBe(contenido)
    expect(readdirSync(dir)).toEqual(['mod.jar'])
  })

  it('RECHAZA un archivo cuyo hash no es el esperado, y no lo deja en disco', async () => {
    // El caso que justifica la función entera.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta('contenido cambiado')))
    const destino = join(dir, 'mod.jar')

    await expect(
      downloadVerified('https://ejemplo/mod.jar', destino, {
        expected: sha1('lo que el manifiesto esperaba'),
        algo: 'sha1',
        label: 'mod.jar'
      })
    ).rejects.toThrow(/corrupto/)

    expect(existsSync(destino)).toBe(false)
    expect(existsSync(`${destino}.part`)).toBe(false)
  })

  it('no borra el archivo bueno anterior si la descarga nueva viene corrupta', async () => {
    // Lo peor que podría hacer: dejar al jugador sin el jar que ya tenía.
    const destino = join(dir, 'mod.jar')
    writeFileSync(destino, 'el jar bueno de antes', 'utf8')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta('basura')))

    await expect(
      downloadVerified('https://ejemplo/mod.jar', destino, {
        expected: sha1('otra cosa'),
        algo: 'sha1',
        label: 'mod.jar'
      })
    ).rejects.toThrow()

    expect(readFileSync(destino, 'utf8')).toBe('el jar bueno de antes')
  })

  it('falla con el código HTTP cuando el servidor no lo tiene', async () => {
    // El 404 real que ya pasó: un jar en el manifiesto que nunca se subió a R2.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta('', { ok: false, status: 404 })))

    await expect(
      downloadVerified('https://ejemplo/no-existe.jar', join(dir, 'x.jar'), {
        expected: sha1(''),
        algo: 'sha1',
        label: 'no-existe.jar'
      })
    ).rejects.toThrow(/404/)

    expect(readdirSync(dir)).toEqual([])
  })

  it('crea la carpeta destino si no está', async () => {
    const contenido = 'x'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(contenido)))
    const destino = join(dir, 'mods', 'anidado', 'mod.jar')

    await downloadVerified('https://ejemplo/mod.jar', destino, {
      expected: sha1(contenido),
      algo: 'sha1',
      label: 'mod.jar'
    })

    expect(readFileSync(destino, 'utf8')).toBe(contenido)
  })

  it('informa el avance con los bytes recibidos', async () => {
    // Es lo que separa una descarga lenta de una colgada, en la pantalla.
    const contenido = 'doce bytes!'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(contenido)))
    const avances: Array<[number, number]> = []

    await downloadVerified('https://ejemplo/mod.jar', join(dir, 'mod.jar'), {
      expected: sha1(contenido),
      algo: 'sha1',
      label: 'mod.jar',
      onProgress: (recibido, total) => avances.push([recibido, total])
    })

    expect(avances.length).toBeGreaterThan(0)
    expect(avances[avances.length - 1][0]).toBe(contenido.length)
  })

  it('pisa un .part viejo de una descarga interrumpida', async () => {
    const contenido = 'entero esta vez'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta(contenido)))
    const destino = join(dir, 'mod.jar')
    writeFileSync(`${destino}.part`, 'a medio bajar de la vez anterior', 'utf8')

    await downloadVerified('https://ejemplo/mod.jar', destino, {
      expected: sha1(contenido),
      algo: 'sha1',
      label: 'mod.jar'
    })

    expect(readFileSync(destino, 'utf8')).toBe(contenido)
    expect(readdirSync(dir)).toEqual(['mod.jar'])
  })
})
