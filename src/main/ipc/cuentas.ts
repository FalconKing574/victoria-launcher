import { app, ipcMain, safeStorage, shell } from 'electron'
import { execFile } from 'child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { totalmem } from 'os'
import { equipoIdPath, victoriaPasswordViejaPath, victoriaSesionPath } from '../lib/paths'
import { obtenerHuella } from '../lib/huella'
import { llamar, ServidorCaido, type AuthManifest, type Respuesta } from '../lib/cuentas-api'
import { esperarCodigoDiscord } from '../lib/discord-local'
import { fetchManifest } from './sync'

/**
 * La cuenta de Victoria, del lado del proceso main.
 *
 * ## El token de sesión no sale de acá
 *
 * El servidor lo devuelve al entrar o registrarse; este archivo lo guarda con
 * `safeStorage` y lo **saca de la respuesta** antes de pasársela al renderer.
 * La interfaz no lo necesita para nada, y lo que no llega al renderer no se
 * puede filtrar por una devtools abierta o un script inyectado.
 *
 * ## Sin llavero, sólo en memoria
 *
 * Si `safeStorage` no está disponible no se escribe nada en disco: el jugador
 * vuelve a entrar la próxima vez que abra el launcher. Es molesto, no inseguro.
 */

let sesionEnMemoria: string | null = null
let huellaCache: Promise<string> | null = null

function guardarSesion(token: string): void {
  sesionEnMemoria = token
  if (!safeStorage.isEncryptionAvailable()) return
  try {
    writeFileSync(victoriaSesionPath(), safeStorage.encryptString(token))
  } catch {
    // Recordarla es una comodidad: un disco lleno no puede romper un login que ya salió bien.
  }
}

function leerSesion(): string | null {
  if (sesionEnMemoria) return sesionEnMemoria
  if (!existsSync(victoriaSesionPath()) || !safeStorage.isEncryptionAvailable()) return null
  try {
    sesionEnMemoria = safeStorage.decryptString(readFileSync(victoriaSesionPath()))
    return sesionEnMemoria
  } catch {
    return null
  }
}

function borrarSesion(): void {
  sesionEnMemoria = null
  if (existsSync(victoriaSesionPath())) rmSync(victoriaSesionPath())
}

function huella(): Promise<string> {
  if (!huellaCache) {
    huellaCache = obtenerHuella({
      regQuery: () =>
        new Promise((resolve, reject) =>
          execFile(
            'reg',
            ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'],
            { windowsHide: true, timeout: 5000 },
            (error, stdout) => (error ? reject(error) : resolve(stdout))
          )
        ),
      leerRespaldo: () => (existsSync(equipoIdPath()) ? readFileSync(equipoIdPath(), 'utf8').trim() : null),
      guardarRespaldo: (id) => writeFileSync(equipoIdPath(), id, 'utf8')
    })
  }
  return huellaCache
}

async function auth(): Promise<AuthManifest> {
  const manifest = await fetchManifest()
  if (!manifest.auth) throw new ServidorCaido()
  return manifest.auth
}

/** Guarda la sesión si vino, la saca de la respuesta, y olvida la guardada si el servidor dijo que venció. */
function recordar(r: Respuesta): Respuesta {
  if (r.ok && r.sesion) guardarSesion(r.sesion)
  if (!r.ok && r.error === 'sesion') borrarSesion()
  const { sesion: _sesion, vale: _vale, ...resto } = r
  return resto
}

async function conSesion(op: string, datos: Record<string, unknown> = {}): Promise<Respuesta> {
  const sesion = leerSesion()
  if (!sesion) return { ok: false, error: 'sesion', mensaje: 'Entrá a tu cuenta de Victoria.' }
  const r = await llamar(await auth(), op, { ...datos, sesion, huella: await huella() })
  if (!r.ok && r.error === 'sesion') borrarSesion()
  return r
}

async function sinSesion(op: string, datos: Record<string, unknown>): Promise<Respuesta> {
  return llamar(await auth(), op, { ...datos, huella: await huella() })
}

/** Nunca tira hacia el renderer: un servidor caído es una respuesta más. */
async function envolver(fn: () => Promise<Respuesta>): Promise<Respuesta> {
  try {
    return recordar(await fn())
  } catch (e) {
    if (e instanceof ServidorCaido) return { ok: false, error: 'caido', mensaje: e.message }
    return { ok: false, error: 'desconocida', mensaje: (e as Error).message }
  }
}

/**
 * El vale para lanzar el juego. Lo usa `ipc/launch.ts`; el vale tampoco pasa
 * por el renderer.
 */
export async function pedirValeCuenta(): Promise<Respuesta> {
  try {
    return await conSesion('vale')
  } catch (e) {
    if (e instanceof ServidorCaido) return { ok: false, error: 'caido', mensaje: e.message }
    return { ok: false, error: 'desconocida', mensaje: (e as Error).message }
  }
}

function tipoDeGpu(vendorId: number | undefined): 'nvidia' | 'amd' | 'intel' | 'otra' {
  if (vendorId === 0x10de) return 'nvidia'
  if (vendorId === 0x1002) return 'amd'
  if (vendorId === 0x8086) return 'intel'
  return 'otra'
}

export function registerCuentasHandlers(): void {
  // El flujo viejo guardaba la contraseña de AuthMe. Si quedó el archivo, se borra.
  if (existsSync(victoriaPasswordViejaPath())) {
    try {
      rmSync(victoriaPasswordViejaPath())
    } catch {
      // No importa: nadie lo lee más.
    }
  }

  ipcMain.handle('cuentas:estado', () => envolver(() => conSesion('cuenta')))
  ipcMain.handle('cuentas:registrar', (_e, d: { nombre: string; contrasena: string; correo: string }) =>
    envolver(() => sinSesion('registrar', d))
  )
  ipcMain.handle('cuentas:confirmar', (_e, d: { correo: string; codigo: string }) =>
    envolver(() => sinSesion('confirmar', d))
  )
  ipcMain.handle('cuentas:reenviar', (_e, d: { correo: string; proposito: string }) =>
    envolver(() => sinSesion('reenviar', d))
  )
  ipcMain.handle('cuentas:entrar', (_e, d: { nombre: string; contrasena: string }) =>
    envolver(() => sinSesion('entrar', d))
  )
  ipcMain.handle('cuentas:premium', (_e, mcToken: string) => envolver(() => sinSesion('premium', { mcToken })))
  ipcMain.handle('cuentas:discord', () =>
    envolver(async () => {
      const manifest = await fetchManifest()
      const discord = manifest.auth?.discord
      if (!discord) {
        return { ok: false, error: 'discord_caido', mensaje: 'El launcher no tiene los datos de Discord. Probá en un rato.' }
      }
      let code: string
      try {
        code = await esperarCodigoDiscord({
          clientId: discord.clientId,
          puerto: discord.puerto,
          abrir: (url) => shell.openExternal(url)
        })
      } catch (e) {
        return { ok: false, error: 'discord_cancelado', mensaje: (e as Error).message }
      }
      return conSesion('discord', { code })
    })
  )
  ipcMain.handle('cuentas:normas', (_e, version: number) => envolver(() => conSesion('normas', { version })))
  ipcMain.handle('cuentas:tutorial', () => envolver(() => conSesion('tutorial')))
  ipcMain.handle('cuentas:recuperar', (_e, correo: string) => envolver(() => sinSesion('recuperar', { correo })))
  ipcMain.handle('cuentas:restablecer', (_e, d: { correo: string; codigo: string; contrasena: string }) =>
    envolver(() => sinSesion('restablecer', d))
  )
  ipcMain.handle('cuentas:salir', async () => {
    const r = await envolver(() => conSesion('salir'))
    borrarSesion()
    return r.ok || r.error === 'caido' ? { ok: true } : r
  })

  ipcMain.handle('sistema:equipo', async () => {
    let vendorId: number | undefined
    try {
      const info = (await app.getGPUInfo('basic')) as { gpuDevice?: Array<{ vendorId: number; active?: boolean }> }
      const activa = info.gpuDevice?.find((g) => g.active) ?? info.gpuDevice?.[0]
      vendorId = activa?.vendorId
    } catch {
      vendorId = undefined
    }
    return { memoriaMb: Math.round(totalmem() / 1024 / 1024), gpu: tipoDeGpu(vendorId) }
  })
}
