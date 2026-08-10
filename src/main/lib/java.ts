import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

export interface PickJavaOptions {
  override: string | null
  candidates: string[]
  exists: (path: string) => boolean
}

/**
 * Chooses a Java executable: an explicit user override wins, then the first
 * candidate that exists on disk, then whatever `java` resolves to on PATH.
 */
export function pickJavaPath({ override, candidates, exists }: PickJavaOptions): string {
  if (override && exists(override)) return override
  const found = candidates.find((candidate) => exists(candidate))
  return found ?? 'java'
}

/**
 * Minecraft 1.20.1 needs Java 17. CurseForge ships it as `java-runtime-gamma`,
 * so an existing CurseForge install gives us a correct JRE for free.
 */
export function javaCandidates(): string[] {
  const cfJava = join(homedir(), 'curseforge', 'minecraft', 'Install', 'java')
  const list = [
    join(cfJava, 'java-runtime-gamma', 'bin', 'javaw.exe'),
    join(cfJava, 'java-runtime-delta', 'bin', 'javaw.exe'),
    join(cfJava, 'Jre_21', 'bin', 'javaw.exe')
  ]
  if (process.env.JAVA_HOME) {
    list.push(join(process.env.JAVA_HOME, 'bin', 'javaw.exe'))
  }
  return list
}

export function detectJava(override: string | null): string {
  return pickJavaPath({ override, candidates: javaCandidates(), exists: existsSync })
}

/** Minecraft 1.20.1 refuses to start on anything older. */
export const MIN_JAVA_MAJOR = 17

/**
 * Reads the major version out of what `java -version` prints.
 *
 * Two shapes exist, and a launcher that only understands the modern one will
 * happily hand Minecraft 1.20.1 a Java 8 it cannot use:
 *   openjdk version "17.0.19" 2026-01-20   -> 17
 *   java version "1.8.0_381"               -> 8   (the old 1.x scheme)
 */
export function parseJavaMajor(output: string): number | null {
  const match = /version "(\d+)(?:\.(\d+))?/.exec(output)
  if (!match) return null

  const first = Number(match[1])
  if (first === 1) {
    const second = match[2] === undefined ? NaN : Number(match[2])
    return Number.isNaN(second) ? null : second
  }
  return first
}
