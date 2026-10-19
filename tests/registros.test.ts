import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, utimesSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  abrirRegistroJuego,
  leerFinal,
  listarRegistros,
  rutaDeRegistro,
  taparSecretos,
  type CarpetasRegistros
} from '../src/main/lib/registros'

describe('registros', () => {
  let base: string
  let c: CarpetasRegistros

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'victoria-registros-'))
    c = { datos: join(base, 'datos'), instancia: join(base, 'instancia'), minecraft: join(base, 'mc') }
    mkdirSync(join(c.datos, 'logs'), { recursive: true })
    mkdirSync(join(c.instancia, 'logs'), { recursive: true })
    mkdirSync(join(c.instancia, 'crash-reports'), { recursive: true })
  })

  afterEach(() => rmSync(base, { recursive: true, force: true }))

  it('lista sólo los que existen, en orden, y el crash report más nuevo', () => {
    writeFileSync(join(c.instancia, 'logs', 'latest.log'), 'hola')
    writeFileSync(join(c.datos, 'logs', 'juego.log'), 'arranque')
    const viejo = join(c.instancia, 'crash-reports', 'crash-viejo.txt')
    const nuevo = join(c.instancia, 'crash-reports', 'crash-nuevo.txt')
    writeFileSync(viejo, 'a')
    writeFileSync(nuevo, 'b')
    utimesSync(viejo, new Date(2020, 1, 1), new Date(2020, 1, 1))
    const l = listarRegistros(c)
    expect(l.map((r) => r.id)).toEqual(['juego', 'crash', 'latest'])
    expect(l[1].ruta).toBe(nuevo)
    expect(l[0].tamano).toBe(8)
  })

  it('un id desconocido no resuelve a ninguna ruta', () => {
    expect(rutaDeRegistro(c, '../../etc/passwd')).toBeNull()
    expect(rutaDeRegistro(c, 'latest')).toBeNull()
  })

  it('lee el final y empieza en un renglón entero', async () => {
    const ruta = join(c.datos, 'x.log')
    writeFileSync(ruta, 'primero\nsegundo\ntercero\n')
    const todo = await leerFinal(ruta)
    expect(todo).toEqual({ texto: 'primero\nsegundo\ntercero\n', recortado: false, tamano: 24 })
    const parte = await leerFinal(ruta, 12)
    expect(parte.recortado).toBe(true)
    expect(parte.texto).toBe('tercero\n')
  })

  it('tapa el token de Minecraft y los JWT', () => {
    expect(taparSecretos('--username Juan --accessToken abc.def.ghi --uuid 1')).toBe(
      '--username Juan --accessToken [oculto] --uuid 1'
    )
    expect(taparSecretos('token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc fin')).toBe('token [token oculto] fin')
  })

  it('el registro del arranque guarda el anterior y escribe uno nuevo', async () => {
    const r1 = abrirRegistroJuego(c.datos)
    r1.escribir('primer intento')
    await new Promise<void>((ok) => {
      r1.cerrar()
      setTimeout(ok, 50)
    })
    const r2 = abrirRegistroJuego(c.datos)
    r2.escribir('segundo --accessToken secreto')
    await new Promise<void>((ok) => {
      r2.cerrar()
      setTimeout(ok, 50)
    })
    expect(readFileSync(join(c.datos, 'logs', 'juego-anterior.log'), 'utf8')).toBe('primer intento\n')
    expect(readFileSync(join(c.datos, 'logs', 'juego.log'), 'utf8')).toBe('segundo --accessToken [oculto]\n')
    expect(existsSync(join(c.datos, 'logs', 'juego.log'))).toBe(true)
  })
})
