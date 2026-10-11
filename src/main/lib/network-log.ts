import { app } from 'electron'
import { appendFileSync, existsSync, renameSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import { networkCodes } from './network-error'

/** No registra mensajes, URLs, cuerpos, nombres de cuentas ni credenciales. */
export function logNetwork(service: string, stage: string, error?: unknown): void {
  try {
    const file = join(app.getPath('userData'), 'conexion-launcher.log')
    if (existsSync(file) && statSync(file).size > 512_000) {
      rmSync(`${file}.1`, { force: true })
      renameSync(file, `${file}.1`)
    }
    appendFileSync(file, JSON.stringify({ time: new Date().toISOString(), version: app.getVersion(), service, stage, codes: networkCodes(error) }) + '\n', 'utf8')
  } catch { /* Un problema al escribir el diagnóstico no impide entrar. */ }
}
