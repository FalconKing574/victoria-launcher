import { describe, it, expect } from 'vitest'
import { permisoPermitido } from '../src/main/lib/permisos'

describe('permisoPermitido', () => {
  it('pantalla completa sí', () => {
    expect(permisoPermitido('fullscreen')).toBe(true)
  })

  it('micrófono sí: lo usa la prueba de la configuración guiada', () => {
    expect(permisoPermitido('media', { mediaTypes: ['audio'] })).toBe(true)
    expect(permisoPermitido('media', { mediaType: 'audio' })).toBe(true)
  })

  it('cámara no, ni sola ni junto con el micrófono', () => {
    expect(permisoPermitido('media', { mediaTypes: ['video'] })).toBe(false)
    expect(permisoPermitido('media', { mediaTypes: ['audio', 'video'] })).toBe(false)
    expect(permisoPermitido('media', { mediaType: 'video' })).toBe(false)
  })

  it('media sin saber qué pide, no', () => {
    expect(permisoPermitido('media')).toBe(false)
    expect(permisoPermitido('media', { mediaType: 'unknown' })).toBe(false)
  })

  it('el resto sigue cerrado', () => {
    for (const p of ['geolocation', 'notifications', 'midi', 'clipboard-read', 'openExternal', 'display-capture']) {
      expect(permisoPermitido(p)).toBe(false)
    }
  })
})
