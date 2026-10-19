import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { leerNovedades } from '../src/main/lib/novedades'
import { WEB } from '../src/preload/web'

/**
 * Qué protege esto.
 *
 * Las novedades de la pantalla Jugar se leen de la web: el mismo
 * datos/novedades.json que pinta su portada. Si el launcher dejara de
 * entenderlo, Jugar se quedaría para siempre con las tres que trae adentro sin
 * que nadie lo note, porque sin novedades no hay ningún error. Y como el
 * archivo viene de internet, lo que traiga no puede meter imágenes de otro
 * lado ni colores que no lo son.
 */

const buena = {
  id: 'algo-nuevo',
  fecha: '2026-10-18',
  etiqueta: 'Launcher',
  color: '#47bfff',
  imagen: 'img/launcher/jugar.jpg',
  titulo: 'El launcher se repara solo',
  texto: 'Lo detecta y lo vuelve a bajar.'
}

describe('leerNovedades', () => {
  it('entiende el archivo que publica la web', () => {
    const real = JSON.parse(
      readFileSync(new URL('../web/public/datos/novedades.json', import.meta.url), 'utf8')
    )
    const lista = leerNovedades(real, WEB)
    expect(lista).toHaveLength(3)
    // Ninguna se cae por estar mal escrita: el archivo entero es válido.
    expect(leerNovedades(real, WEB, Infinity)).toHaveLength(real.length)
    for (const n of lista ?? []) {
      expect(n.imagen.startsWith(`${WEB}/img/`)).toBe(true)
      expect(n.enlace).toBe(`${WEB}/novedades#${n.id}`)
    }
  })

  it('devuelve las más nuevas primero, aunque el archivo venga en otro orden', () => {
    const lista = leerNovedades(
      [
        { ...buena, id: 'vieja', fecha: '2026-08-02' },
        { ...buena, id: 'nueva', fecha: '2026-10-18' },
        { ...buena, id: 'media', fecha: '2026-09-15' }
      ],
      WEB,
      2
    )
    expect(lista?.map((n) => n.id)).toEqual(['nueva', 'media'])
  })

  it('arma la imagen y el enlace con la dirección de la web', () => {
    const [n] = leerNovedades([buena], WEB) ?? []
    expect(n.imagen).toBe('https://victoriakingdom.com/img/launcher/jugar.jpg')
    expect(n.enlace).toBe('https://victoriakingdom.com/novedades#algo-nuevo')
    expect(n.color).toBe('#47bfff')
  })

  it('salta la que está mal escrita sin tirar abajo las demás', () => {
    const lista = leerNovedades(
      [
        { ...buena, titulo: '' },
        { ...buena, id: 'Con Mayúsculas' },
        { ...buena, fecha: '18/10/2026' },
        buena
      ],
      WEB
    )
    expect(lista?.map((n) => n.id)).toEqual(['algo-nuevo'])
  })

  it('no carga imágenes de otra dirección ni pinta un color que no lo es', () => {
    expect(leerNovedades([{ ...buena, imagen: 'https://ajeno.example/foto.jpg' }], WEB)).toBeNull()
    const [n] = leerNovedades([{ ...buena, color: 'red; background: url(x)' }], WEB) ?? []
    expect(n.color).toBeNull()
  })

  it('sin nada que mostrar, null: la pantalla usa las suyas', () => {
    expect(leerNovedades(null, WEB)).toBeNull()
    expect(leerNovedades({ novedades: [buena] }, WEB)).toBeNull()
    expect(leerNovedades([], WEB)).toBeNull()
    expect(leerNovedades([{ titulo: 'sin nada más' }], WEB)).toBeNull()
  })
})
