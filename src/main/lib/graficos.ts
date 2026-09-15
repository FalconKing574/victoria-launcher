/**
 * Cuando Minecraft no puede usar la placa de video.
 *
 * Un jugador veía «Minecraft se cerró solo. OpenGLException» y nada más. Es de
 * las fallas más comunes en PCs con video integrado (Intel HD, AMD Radeon
 * Graphics) o drivers viejos, y casi nunca es culpa de un mod: el juego no llega
 * ni a abrir la ventana.
 *
 * Tres causas cubren la gran mayoría:
 *
 *   1. La **ventana de carga temprana de Forge** (`earlyWindowControl`). Abre su
 *      propio contexto OpenGL antes que Minecraft, y hay drivers que aceptan uno
 *      pero no el segundo. Apagarla no cambia nada del juego: sólo desaparece la
 *      barrita de carga del principio.
 *   2. **Shaders** de Oculus prendidos en una placa que no los soporta.
 *   3. En notebooks con dos placas, Windows le da **la integrada** a `javaw.exe`.
 *
 * Por eso, cuando el cierre huele a video, el launcher prende un modo compatible
 * que ataca las tres, y se lo dice al jugador en castellano.
 *
 * Todo lo de acá es puro (texto entra, texto sale) para poder probarlo.
 */

/** Frases que Minecraft, LWJGL, GLFW o la JVM escriben cuando falla el video. */
const SENALES_VIDEO: RegExp[] = [
  /OpenGLException/i,
  /GLFW error/i,
  /WGL: The driver does not appear to support OpenGL/i,
  /Pixel format not accelerated/i,
  /Failed to create the GLFW window/i,
  /OpenGL 3\.2/i,
  /No OpenGL context found/i,
  /GL_OUT_OF_MEMORY/i,
  // Cierres nativos de la JVM dentro del driver: Intel, AMD y NVIDIA.
  /EXCEPTION_ACCESS_VIOLATION[\s\S]{0,4000}\b(ig\d*icd(32|64)|igxelpicd|atio6axx|atig6pxx|atiglpxx|amdxc64|nvoglv(32|64)|opengl32)\.dll/i,
  /Problematic frame:[^\n]*\b(ig\d*icd(32|64)|igxelpicd|atio6axx|atig6pxx|atiglpxx|amdxc64|nvoglv(32|64)|opengl32)\.dll/i
]

/** Si el texto (crash report, final del log o hs_err) muestra una falla de video. */
export function esFallaDeVideo(texto: string | null | undefined): boolean {
  if (!texto) return false
  return SENALES_VIDEO.some((r) => r.test(texto))
}

/**
 * `fml.toml` con la ventana de carga temprana apagada.
 *
 * Toca sólo esa línea y deja el resto del archivo como estaba. Si la clave no
 * existe (un fml.toml viejo o vacío), la agrega al final.
 */
export function fmlSinVentanaTemprana(original: string): string {
  const linea = /^(\s*earlyWindowControl\s*=\s*)(true|false)(.*)$/m
  if (linea.test(original)) {
    return original.replace(linea, '$1false$3')
  }
  const base = original.length && !original.endsWith('\n') ? original + '\n' : original
  return base + 'earlyWindowControl = false\n'
}

/** El mensaje para el jugador. Corto, sin jerga, y con lo que ya se hizo. */
export function mensajeFallaDeVideo(): string {
  return (
    'Tu placa de video no pudo iniciar el juego (OpenGL).\n' +
    'Ya activamos el modo compatible: sin pantalla de carga temprana, sin shaders ' +
    'y pidiéndole a Windows la placa de video dedicada. Volvé a tocar JUGAR.\n' +
    'Si vuelve a pasar, actualizá el driver de video (Intel, AMD o NVIDIA) desde la ' +
    'página del fabricante.'
  )
}

/**
 * El valor que Windows lee para decidir qué placa usa un programa
 * (`HKCU\Software\Microsoft\DirectX\UserGpuPreferences`). `2` es «alto
 * rendimiento»: la dedicada si la hay; si no, no cambia nada.
 */
export const PREFERENCIA_GPU_ALTO_RENDIMIENTO = 'GpuPreference=2;'
