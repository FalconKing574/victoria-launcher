import { describe, it, expect } from 'vitest'
import { esFallaDeVideo, fmlSinVentanaTemprana } from '../src/main/lib/graficos'

describe('esFallaDeVideo', () => {
  it('reconoce el OpenGLException que vio el jugador', () => {
    expect(esFallaDeVideo('[Render thread/ERROR]: org.lwjgl.opengl.OpenGLException')).toBe(true)
  })

  it('reconoce GLFW y el driver sin OpenGL', () => {
    expect(esFallaDeVideo('GLFW error 65542: WGL: The driver does not appear to support OpenGL')).toBe(true)
    expect(esFallaDeVideo('GLFW error before init: [0x10008]Pixel format not accelerated')).toBe(true)
  })

  it('reconoce un cierre nativo dentro del driver de Intel o AMD', () => {
    const hsErr = '# EXCEPTION_ACCESS_VIOLATION (0xc0000005)\n# Problematic frame:\n# C  [ig9icd64.dll+0x1a2b3]'
    expect(esFallaDeVideo(hsErr)).toBe(true)
    expect(esFallaDeVideo('# Problematic frame:\n# C  [atio6axx.dll+0x55]'.replace('\n# C', ' C'))).toBe(true)
  })

  it('no confunde un crash de mod con una falla de video', () => {
    expect(esFallaDeVideo('java.lang.IllegalStateException: Image is not allocated.')).toBe(false)
    expect(esFallaDeVideo('java.lang.NullPointerException: null')).toBe(false)
    expect(esFallaDeVideo(null)).toBe(false)
  })
})

describe('fmlSinVentanaTemprana', () => {
  it('apaga sólo earlyWindowControl y deja el resto', () => {
    const original = 'earlyWindowHeight = 768\nearlyWindowControl = true\nearlyWindowProvider = "fmlearlywindow"\n'
    const nuevo = fmlSinVentanaTemprana(original)
    expect(nuevo).toContain('earlyWindowControl = false')
    expect(nuevo).toContain('earlyWindowHeight = 768')
    expect(nuevo).toContain('earlyWindowProvider = "fmlearlywindow"')
    expect(nuevo.split('\n').length).toBe(original.split('\n').length)
  })

  it('es idempotente', () => {
    const una = fmlSinVentanaTemprana('earlyWindowControl = true\n')
    expect(fmlSinVentanaTemprana(una)).toBe(una)
  })

  it('agrega la clave si el archivo no la tiene', () => {
    expect(fmlSinVentanaTemprana('')).toBe('earlyWindowControl = false\n')
    expect(fmlSinVentanaTemprana('a = 1')).toBe('a = 1\nearlyWindowControl = false\n')
  })
})
