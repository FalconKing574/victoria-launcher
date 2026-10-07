import { describe, it, expect } from 'vitest'
import {
  etapasIngreso,
  faltaCodigo,
  faltaContrasenas,
  faltaCorreo,
  faltaEntrar,
  faltaNombre,
  faltaRegistro,
  limpiarCodigo
} from '../src/renderer/src/lib/formulario-cuenta'

/**
 * Qué protege esto.
 *
 * El botón de las pantallas de cuenta dice qué falta en vez de quedarse apagado
 * sin explicar nada. Lo que no puede pasar es que mienta: que diga que falta
 * algo con el formulario completo, o que se habilite con algo mal.
 */

const completo = {
  nombre: 'Aldeano_1',
  contrasena: 'una-clave-larga',
  repetida: 'una-clave-larga',
  correo: 'aldeano@gmail.com'
}

describe('faltaRegistro', () => {
  it('completo: nada que decir, el botón se habilita', () => {
    expect(faltaRegistro(completo)).toBeNull()
  })

  it('pide las cosas en el orden en que están en pantalla', () => {
    expect(faltaRegistro({ ...completo, nombre: '' })).toBe('Escribí tu nombre en el juego')
    expect(faltaRegistro({ ...completo, contrasena: '', repetida: '' })).toBe(
      'Elegí una contraseña'
    )
    expect(faltaRegistro({ ...completo, repetida: '' })).toBe('Repetí la contraseña')
    expect(faltaRegistro({ ...completo, correo: '' })).toBe('Escribí tu correo')
    // Con todo vacío, lo primero.
    expect(faltaRegistro({ nombre: '', contrasena: '', repetida: '', correo: '' })).toBe(
      'Escribí tu nombre en el juego'
    )
  })

  it('dice qué está mal, no sólo que falta', () => {
    expect(faltaRegistro({ ...completo, contrasena: 'corta', repetida: 'corta' })).toBe(
      'La contraseña: mínimo 8 caracteres'
    )
    expect(faltaRegistro({ ...completo, repetida: 'otra-clave-larga' })).toBe(
      'Las contraseñas no coinciden'
    )
    expect(faltaRegistro({ ...completo, correo: 'aldeano@gmail' })).toBe(
      'Ese correo no parece válido'
    )
  })
})

describe('faltaNombre', () => {
  it('largo y caracteres, con mensajes distintos', () => {
    expect(faltaNombre('ab')).toBe('El nombre va de 3 a 16 caracteres')
    expect(faltaNombre('a'.repeat(17))).toBe('El nombre va de 3 a 16 caracteres')
    expect(faltaNombre('con espacio')).toBe('El nombre: sólo letras, números y _')
    expect(faltaNombre('Ñandú')).toBe('El nombre: sólo letras, números y _')
    expect(faltaNombre('Steve_99')).toBeNull()
  })
})

describe('faltaCorreo', () => {
  it('acepta espacios alrededor, que es como se pega un correo', () => {
    expect(faltaCorreo('  aldeano@gmail.com ')).toBeNull()
    expect(faltaCorreo('   ')).toBe('Escribí tu correo')
  })
})

describe('faltaContrasenas', () => {
  it('ocho caracteres alcanzan', () => {
    expect(faltaContrasenas('12345678', '12345678')).toBeNull()
    expect(faltaContrasenas('1234567', '1234567')).toBe('La contraseña: mínimo 8 caracteres')
  })
})

describe('faltaEntrar', () => {
  it('sólo pide que estén los dos: la contraseña la juzga el servidor', () => {
    expect(faltaEntrar({ nombre: '', contrasena: 'x' })).toBe('Escribí tu nombre')
    expect(faltaEntrar({ nombre: 'Steve', contrasena: '' })).toBe('Escribí tu contraseña')
    expect(faltaEntrar({ nombre: 'Steve', contrasena: 'x' })).toBeNull()
  })
})

describe('el código del correo', () => {
  it('seis números y nada más', () => {
    expect(faltaCodigo('12345')).toBe('Escribí el código de 6 números')
    expect(faltaCodigo('123456')).toBeNull()
  })

  it('un código pegado con espacios o guiones entra igual', () => {
    expect(limpiarCodigo('123 456')).toBe('123456')
    expect(limpiarCodigo('123-456')).toBe('123456')
    expect(limpiarCodigo(' 1 2 3 4 5 6 ')).toBe('123456')
  })

  it('se corta en seis y descarta letras', () => {
    expect(limpiarCodigo('1234567890')).toBe('123456')
    expect(limpiarCodigo('abc12')).toBe('12')
    expect(limpiarCodigo('')).toBe('')
  })
})

describe('etapasIngreso', () => {
  it('el que entra con Microsoft no confirma correo', () => {
    expect(etapasIngreso('NO_PREMIUM')).toContain('Tu correo')
    expect(etapasIngreso('PREMIUM')).not.toContain('Tu correo')
  })

  it('las dos terminan igual, y tienen lo que piden los pasos', () => {
    for (const tipo of ['PREMIUM', 'NO_PREMIUM'] as const) {
      const etapas = etapasIngreso(tipo)
      expect(etapas[0]).toBe('Tu cuenta')
      expect(etapas.at(-1)).toBe('Recorrido')
      // Pasos.tsx busca estas dos por nombre.
      expect(etapas).toContain('Discord')
      expect(etapas).toContain('Normas')
    }
  })
})
