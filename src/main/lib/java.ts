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
