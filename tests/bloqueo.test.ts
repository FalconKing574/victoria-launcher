import { describe, it, expect } from 'vitest'
import { leerBloqueo } from '../src/renderer/src/lib/bloqueo'

describe('leerBloqueo', () => {
  it('saca la respuesta del error que arma Electron al cruzar el IPC', () => {
    const json = JSON.stringify({ ok: false, error: 'sancion', mensaje: 'Tu cuenta está baneada.', sancion: { propia: true, mensaje: 'x', permanente: true } })
    const mensaje = `Error invoking remote method 'launch:start': Error: VICTORIA_BLOQUEO:${json}`
    const r = leerBloqueo(mensaje)
    expect(r?.error).toBe('sancion')
    expect(r?.sancion?.permanente).toBe(true)
  })

  it('también sin el prefijo de Electron (evento launch:error)', () => {
    expect(leerBloqueo('VICTORIA_BLOQUEO:{"ok":false,"error":"pasos","pasos":["discord"]}')?.pasos).toEqual(['discord'])
  })

  it('un error cualquiera no es un bloqueo', () => {
    expect(leerBloqueo('No se pudo iniciar Minecraft.')).toBeNull()
    expect(leerBloqueo('VICTORIA_BLOQUEO:{roto')).toBeNull()
  })
})
