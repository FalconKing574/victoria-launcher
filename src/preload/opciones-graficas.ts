/**
 * La configuración gráfica con la que arranca un jugador nuevo (02-10-2026).
 *
 * ## Por qué
 *
 * Hasta ahora el launcher le escribía al jugador nuevo una sola línea de
 * `options.txt` (la del resource pack) y Minecraft completaba el resto con sus
 * valores de fábrica: gráficos «elegantes», mezcla de biomas al máximo, mipmaps
 * 4, nubes y 12 chunks de distancia. Con 125 mods, Distant Horizons y la ciudad
 * entera cargada, eso es justo lo que hace que la primera impresión sea «anda
 * mal». El usuario: «que cuando alguien abra el servidor y entre por primera vez
 * tenga una configuración básica optimizada».
 *
 * ## Qué se toca
 *
 * Sólo lo de video que cuesta rendimiento sin ganar nada en este servidor:
 *
 * - **Distancia de render 12**: el servidor manda 8 chunks (`view-distance=8`) y
 *   lo de más lejos lo dibuja Distant Horizons; más que 12 no se ve más.
 * - **Simulación 6**: en multijugador la decide el servidor; se iguala.
 * - **Mezcla de biomas** y **mipmaps**, **nubes** (Distant Horizons dibuja las
 *   suyas) y la **distancia de entidades**.
 *
 * Teclas, sonido, idioma, FOV, sensibilidad: nada. Y se aplica UNA vez: después
 * el archivo es del jugador (ver {@link aplicarOpciones}).
 *
 * Todo puro: texto entra, texto sale.
 */

export type PresetGrafico = 'liviana' | 'equilibrada' | 'alta'

export interface InfoPreset {
  id: PresetGrafico
  nombre: string
  detalle: string
}

export const INFO_PRESETS: InfoPreset[] = [
  {
    id: 'liviana',
    nombre: 'Liviana',
    detalle: 'Para video integrado o PCs justas: gráficos rápidos, menos partículas, 60 FPS.'
  },
  {
    id: 'equilibrada',
    nombre: 'Equilibrada',
    detalle: 'Se ve bien y anda fluido en la mayoría de las PCs con placa dedicada.'
  },
  {
    id: 'alta',
    nombre: 'Alta',
    detalle: 'Para placas dedicadas potentes: gráficos elegantes y transiciones suaves.'
  }
]

/** Las líneas de `options.txt` de cada preset (formato `clave:valor` de Minecraft). */
export const PRESETS: Record<PresetGrafico, Record<string, string>> = {
  liviana: {
    renderDistance: '8',
    simulationDistance: '5',
    graphicsMode: '0',
    biomeBlendRadius: '0',
    mipmapLevels: '2',
    particles: '1',
    entityDistanceScaling: '0.75',
    entityShadows: 'false',
    renderClouds: '"false"',
    ao: 'true',
    maxFps: '60',
    enableVsync: 'true',
    prioritizeChunkUpdates: '0'
  },
  equilibrada: {
    renderDistance: '12',
    simulationDistance: '6',
    graphicsMode: '0',
    biomeBlendRadius: '0',
    mipmapLevels: '2',
    particles: '0',
    entityDistanceScaling: '0.75',
    entityShadows: 'true',
    renderClouds: '"false"',
    ao: 'true',
    maxFps: '120',
    enableVsync: 'false',
    prioritizeChunkUpdates: '0'
  },
  alta: {
    renderDistance: '12',
    simulationDistance: '6',
    graphicsMode: '1',
    biomeBlendRadius: '2',
    mipmapLevels: '4',
    particles: '0',
    entityDistanceScaling: '1.0',
    entityShadows: 'true',
    renderClouds: '"false"',
    ao: 'true',
    maxFps: '144',
    enableVsync: 'false',
    prioritizeChunkUpdates: '0'
  }
}

/**
 * El preset que conviene según la PC. La placa manda: con video integrado (Intel
 * o desconocido) el juego entero depende de esto. Con dedicada y poca memoria
 * (menos de 12 GB en total) se queda en la equilibrada.
 */
export function presetSugerido(gpu: string, memoriaMb: number): PresetGrafico {
  if (gpu !== 'nvidia' && gpu !== 'amd') return 'liviana'
  return memoriaMb >= 16 * 1024 ? 'alta' : 'equilibrada'
}

export function esPreset(valor: unknown): valor is PresetGrafico {
  return valor === 'liviana' || valor === 'equilibrada' || valor === 'alta'
}

/**
 * `options.txt` con esas claves puestas, sin tocar ninguna otra línea. Las que no
 * estaban se agregan al final. Con `original` null arma el archivo desde cero
 * (Minecraft completa lo demás la primera vez que abre).
 */
export function aplicarOpciones(original: string | null, valores: Record<string, string>): string {
  const faltan = new Map(Object.entries(valores))
  const lineas = (original ?? '').split(/\r?\n/).map((linea) => {
    const dos = linea.indexOf(':')
    if (dos <= 0) return linea
    const clave = linea.slice(0, dos)
    if (!faltan.has(clave)) return linea
    const valor = faltan.get(clave) as string
    faltan.delete(clave)
    return `${clave}:${valor}`
  })
  // sin la línea vacía final del split, que si no se multiplica en cada escritura
  while (lineas.length > 0 && lineas[lineas.length - 1] === '') lineas.pop()
  for (const [clave, valor] of faltan) lineas.push(`${clave}:${valor}`)
  return `${lineas.join('\n')}\n`
}
