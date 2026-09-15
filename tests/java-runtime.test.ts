import { describe, it, expect, afterEach, vi } from 'vitest'

const spawnSync = vi.hoisted(() => vi.fn())
vi.mock('child_process', () => ({ spawnSync }))

// Sin esto el import arrastra `paths` -> `electron`, y vitest se pone a bajar el
// binario de Electron: diecisiete segundos y una dependencia de red en un test
// que no necesita ninguna de las dos cosas.
vi.mock('electron', () => ({ app: { getPath: () => '/tmp/fake-userdata' } }))

import { probeJavaMajor } from '../src/main/lib/java-runtime'

/**
 * Qué protege esto.
 *
 * `probeJavaMajor` es lo que decide si el Java que hay en la máquina sirve o si
 * el launcher tiene que bajarse uno. Es la única pregunta entre «el juego
 * arranca» y «el jugador ve un error de versión que no entiende», y toda su
 * dificultad está en los casos raros:
 *
 *  - En una máquina sin Java, ejecutar `java` **tira una excepción**, no
 *    devuelve un código de error. Si eso escapara, el launcher se caería justo
 *    en la gente que más lo necesita.
 *  - `java -version` escribe en **stderr**, no en stdout. Pero no en todas las
 *    distribuciones, así que hay que leer las dos.
 *
 * Ninguno de los dos se nota probando en una máquina que ya tiene Java bien
 * instalado — que es la del que escribe el código.
 */

const resultado = (o: {
  stdout?: string
  stderr?: string
  status?: number
  error?: Error
}): unknown => ({
  stdout: o.stdout ?? '',
  stderr: o.stderr ?? '',
  status: o.status ?? 0,
  error: o.error
})

const VERSION_17 = 'openjdk version "17.0.19" 2026-01-20\nOpenJDK Runtime Environment Temurin'

describe('probeJavaMajor', () => {
  afterEach(() => {
    spawnSync.mockReset()
  })

  it('lee la versión de stderr, que es donde java la escribe', () => {
    spawnSync.mockReturnValue(resultado({ stderr: VERSION_17 }))

    expect(probeJavaMajor('java')).toBe(17)
  })

  it('la lee de stdout también, porque no todas las distribuciones usan stderr', () => {
    spawnSync.mockReturnValue(resultado({ stdout: VERSION_17 }))

    expect(probeJavaMajor('java')).toBe(17)
  })

  it('NO EXPLOTA cuando no hay Java en la máquina', () => {
    // El caso del jugador nuevo: spawnSync tira, no devuelve un status.
    spawnSync.mockImplementation(() => {
      throw new Error('spawnSync java ENOENT')
    })

    expect(() => probeJavaMajor('java')).not.toThrow()
    expect(probeJavaMajor('java')).toBeNull()
  })

  it('devuelve null cuando spawnSync informa el error en vez de tirarlo', () => {
    // La otra forma en que Node avisa lo mismo.
    spawnSync.mockReturnValue(resultado({ error: new Error('ENOENT') }))

    expect(probeJavaMajor('java')).toBeNull()
  })

  it('devuelve null cuando el ejecutable corre pero falla', () => {
    spawnSync.mockReturnValue(resultado({ status: 1, stderr: 'no soy java' }))

    expect(probeJavaMajor('java')).toBeNull()
  })

  it('devuelve null cuando la salida no dice ninguna versión', () => {
    spawnSync.mockReturnValue(resultado({ stderr: 'hola' }))

    expect(probeJavaMajor('java')).toBeNull()
  })

  it('entiende un Java 8, que es el que hay que rechazar', () => {
    // El caso real: una máquina con el JRE 8 de siempre. Tiene que reconocerse
    // como 8 y no como null, o el launcher no sabría por qué no sirve.
    spawnSync.mockReturnValue(
      resultado({ stderr: 'java version "1.8.0_501"\nJava(TM) SE Runtime Environment' })
    )

    expect(probeJavaMajor('java')).toBe(8)
  })

  it('le pone un límite de tiempo al sondeo', () => {
    // Un java colgado no puede dejar el launcher colgado con él.
    spawnSync.mockReturnValue(resultado({ stderr: VERSION_17 }))

    probeJavaMajor('java')

    const opciones = spawnSync.mock.calls[0][2] as { timeout?: number }
    expect(opciones.timeout).toBeGreaterThan(0)
  })
})
