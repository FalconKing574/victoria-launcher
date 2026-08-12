import { describe, it, expect } from 'vitest'
import {
  summarizeCrashReport,
  describeCrash,
  crashCulprit,
  lastErrorInLog
} from '../src/main/lib/crash-report'

/**
 * Recortes de crash reports reales de esta instancia. Inventar el formato sería
 * probar mi idea de un crash report, no el que escribe Minecraft.
 */
const CRASH_FOTO = `---- Minecraft Crash Report ----
// Embeddium instance tainted by mods: [fusion, flerovium, betterfpsdist, oculus]

Time: 2026-08-09 13:54:07
Description: mouseClicked event handler

java.lang.IllegalStateException: Image is not allocated.
\tat com.mojang.blaze3d.platform.NativeImage.m_85124_(NativeImage.java:157) ~[client-1.20.1-20230612.114412-srg.jar%23390!/:?] {re:mixin}
\tat com.podloot.eyemod.gui.client.Photos.toArray(Photos.java:29) ~[eyemod-3.0.0.jar%23305!/:3.0.0] {re:classloading}
\tat com.victoriarp.mod.phone.fotos.Fotos.aTag(Fotos.java:80) ~[victoriarp-1.7.0.jar%23386!/:1.7.0] {re:classloading}
`

const CRASH_TEXTURA = `---- Minecraft Crash Report ----

Time: 2026-06-07 12:57:18
Description: mouseClicked event handler

java.lang.IllegalStateException: Texture not loaded yet: minecraft:gtbench_custom_4062df74_textures_parts_iav_wheel.png
\tat com.velleagle.gtbench.paintshop.TextureRepainter.repaintColor(TextureRepainter.java:54) ~[iv-paint-beta-1.0.5.jar%23327!/:1.0.0] {re:classloading}
`

const CRASH_SIN_MENSAJE = `---- Minecraft Crash Report ----

Time: 2026-06-01 23:20:04
Description: Rendering screen

java.lang.NullPointerException: null
\tat net.minecraft.client.gui.screens.Screen.m_88315_(Screen.java:99) ~[client-1.20.1-20230612.114412-srg.jar%23383!/:?] {re:mixin}
\tat com.victoriarp.mod.phone.PhoneScreen.render(PhoneScreen.java:44) ~[victoriarp-1.7.0.jar%23386!/:1.7.0] {re:classloading}
`

describe('summarizeCrashReport', () => {
  it('saca lo que estaba haciendo el juego y la excepción', () => {
    const s = summarizeCrashReport(CRASH_FOTO)
    expect(s.description).toBe('mouseClicked event handler')
    expect(s.exception).toBe('IllegalStateException: Image is not allocated.')
  })

  it('conserva el mensaje largo de la excepción', () => {
    expect(summarizeCrashReport(CRASH_TEXTURA).exception).toContain('Texture not loaded yet')
  })

  it('omite el «null» que Minecraft pone cuando no hay mensaje', () => {
    expect(summarizeCrashReport(CRASH_SIN_MENSAJE).exception).toBe('NullPointerException')
  })

  it('no revienta con un texto que no es un crash report', () => {
    expect(summarizeCrashReport('hola')).toEqual({
      description: null,
      exception: null,
      mod: null
    })
  })
})

describe('crashCulprit', () => {
  it('se salta el jar del juego y señala el primer mod de la pila', () => {
    expect(crashCulprit(CRASH_FOTO)).toBe('eyemod-3.0.0.jar')
  })

  it('lo encuentra aunque el mod esté en la primera línea', () => {
    expect(crashCulprit(CRASH_TEXTURA)).toBe('iv-paint-beta-1.0.5.jar')
  })

  it('nunca culpa a Forge ni al cliente', () => {
    expect(crashCulprit(CRASH_SIN_MENSAJE)).toBe('victoriarp-1.7.0.jar')
  })

  it('devuelve null cuando no hay ningún jar', () => {
    expect(crashCulprit('sin pila')).toBeNull()
  })
})

describe('describeCrash', () => {
  it('junta el qué, el porqué y el mod', () => {
    const texto = describeCrash(summarizeCrashReport(CRASH_FOTO))
    expect(texto).toContain('mouseClicked event handler')
    expect(texto).toContain('Image is not allocated')
    expect(texto).toContain('eyemod-3.0.0.jar')
  })

  it('devuelve null si no entendió nada, para no inventarse una causa', () => {
    expect(describeCrash({ description: null, exception: null, mod: null })).toBeNull()
  })

  it('vale con solo la descripción', () => {
    expect(describeCrash({ description: 'Rendering overlay', exception: null, mod: null })).toBe(
      'Rendering overlay'
    )
  })
})

describe('lastErrorInLog', () => {
  it('encuentra la última excepción del final del log', () => {
    const log = [
      '[22:30:00] [Render thread/INFO]: cargando',
      '[22:30:01] [Render thread/ERROR]: java.lang.OutOfMemoryError: Java heap space',
      '[22:30:02] [Render thread/INFO]: adios'
    ].join('\n')
    expect(lastErrorInLog(log)).toBe('OutOfMemoryError: Java heap space')
  })

  it('ignora nombres de clase que solo contienen la palabra', () => {
    const log = '[22:30:00] [main/INFO]: registrando ExceptionHandler y listo'
    expect(lastErrorInLog(log)).toBeNull()
  })

  it('devuelve null en un log limpio', () => {
    expect(lastErrorInLog('todo bien\nnada que ver')).toBeNull()
  })
})
