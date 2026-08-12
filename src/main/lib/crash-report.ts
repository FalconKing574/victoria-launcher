/**
 * Saca de un crash report de Minecraft la línea que de verdad explica el fallo.
 *
 * Cuando el juego se cierra solo, el launcher decía «Minecraft se cerró con el
 * código 1. Revisa la memoria y la ruta de Java en Ajustes.» — un consejo que
 * casi nunca es el correcto, y que manda al jugador a tocar cosas que no tienen
 * la culpa. Al lado, en la instancia, Minecraft ha dejado un archivo que dice
 * exactamente qué pasó y qué mod estaba en la pila.
 *
 * Puro: recibe el texto, no toca disco, y por eso se puede probar.
 */

export interface CrashSummary {
  /** Lo que Minecraft estaba haciendo: «Rendering overlay», «Unexpected error». */
  description: string | null
  /** La excepción, sin el paquete: `IllegalStateException: Image is not allocated.` */
  exception: string | null
  /** El .jar más arriba en la pila, que suele ser el culpable. */
  mod: string | null
}

/** `net.minecraft.client.Foo$Bar` -> `Foo$Bar`. Los paquetes no dicen nada al jugador. */
function shortenClass(name: string): string {
  const parts = name.split('.')
  return parts[parts.length - 1] ?? name
}

/**
 * El primer `.jar` que aparece en la pila.
 *
 * Se saltan los del juego y los de Forge: siempre están y nunca son la
 * respuesta. El que queda es el mod que estaba ejecutándose.
 */
const IGNORAR = /^(client-|forge-|fmlcore|javafmllanguage|lowcodelanguage|mclanguage|eventbus|securejarhandler|bootstraplauncher)/i

export function crashCulprit(text: string): string | null {
  for (const match of text.matchAll(/\[([^\]%]+\.jar)%/g)) {
    const jar = decodeURIComponent(match[1])
    if (!IGNORAR.test(jar)) return jar
  }
  return null
}

export function summarizeCrashReport(text: string): CrashSummary {
  const description = /^Description:\s*(.+)$/m.exec(text)?.[1]?.trim() ?? null

  // La primera línea con forma de excepción, que es la causa declarada.
  const raw = /^([a-z][\w.]*\.([A-Z]\w*(?:Exception|Error)))(?::\s*(.*))?$/m.exec(text)
  let exception: string | null = null
  if (raw) {
    const nombre = shortenClass(raw[1])
    const mensaje = (raw[3] ?? '').trim()
    exception = mensaje && mensaje !== 'null' ? `${nombre}: ${mensaje}` : nombre
  }

  return { description, exception, mod: crashCulprit(text) }
}

/**
 * Un texto corto para enseñar en la pantalla de Jugar.
 *
 * Devuelve null cuando no se pudo entender nada: mejor el mensaje genérico de
 * siempre que inventar una explicación.
 */
export function describeCrash(summary: CrashSummary): string | null {
  const partes: string[] = []
  if (summary.description) partes.push(summary.description)
  if (summary.exception) partes.push(summary.exception)
  if (!partes.length) return null

  const linea = partes.join(' — ')
  return summary.mod ? `${linea}\nMod implicado: ${summary.mod}` : linea
}

/**
 * Último recurso: rebusca una excepción en el final del log.
 *
 * Hay cierres que no dejan crash report (una caída del driver de vídeo, o que
 * el sistema mate el proceso). Aun así el log suele tener la última línea de
 * error, y decir eso es más útil que hablar de memoria y de Java.
 */
export function lastErrorInLog(log: string): string | null {
  const lineas = log.split(/\r?\n/)
  for (let i = lineas.length - 1; i >= 0 && i > lineas.length - 400; i--) {
    const linea = lineas[i]
    const match = /([A-Z]\w*(?:Exception|Error))(?::\s*(.+))?/.exec(linea)
    if (!match) continue
    // «...ExceptionHandler» y similares no son excepciones lanzadas.
    if (/Handler|Factory|Listener/.test(match[1])) continue
    const mensaje = (match[2] ?? '').trim()
    return mensaje ? `${match[1]}: ${mensaje.slice(0, 160)}` : match[1]
  }
  return null
}
