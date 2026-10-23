import { ipcMain, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { Auth } from 'msmc'
// msmc's package.json `exports` map only exposes ".", so the deep path
// 'msmc/types/types' does not resolve. The same type is reachable through the
// `types` namespace that msmc re-exports from its entry point.
import type { types } from 'msmc'
import { msTokenPath } from '../lib/paths'
import { isNetworkError } from '../lib/network-error'
import { logNetwork } from '../lib/network-log'

type MclcUser = types.MclcUser

export interface PremiumSession {
  name: string
  uuid: string
  mcToken: string
  mclc: MclcUser
}

/** Stores the Microsoft refresh token encrypted with the OS keychain. */
function saveRefreshToken(token: string): void {
  if (!safeStorage.isEncryptionAvailable()) return
  try {
    writeFileSync(msTokenPath(), safeStorage.encryptString(token))
  } catch {
    // Remembering the session is a convenience. A disk that is full, or an
    // antivirus holding the file, must not turn a login that already succeeded
    // into an error the player cannot make sense of — they just get asked
    // again next time.
  }
}

function readRefreshToken(): string | null {
  if (!existsSync(msTokenPath())) return null
  if (!safeStorage.isEncryptionAvailable()) {
    // Sin esto el fallo es mudo: el archivo esta ahi, no se puede leer, y el
    // launcher se comporta como si nunca hubiera habido sesion.
    console.error('[auth] safeStorage no disponible: no se puede leer la sesion guardada.')
    return null
  }
  try {
    return safeStorage.decryptString(readFileSync(msTokenPath()))
  } catch (e) {
    console.error('[auth] No se pudo descifrar ms-token.bin:', e)
    return null
  }
}

/** Si hay una sesión de Microsoft guardada, aunque no se pueda usar. */
export function hasSavedSession(): boolean {
  return existsSync(msTokenPath())
}

export type RestoreResult =
  /** Sesión válida y lista para jugar. */
  | { status: 'ok'; session: PremiumSession }
  /** Había una sesión guardada y ya no sirve. Hay que volver a entrar. */
  | { status: 'expired' }
  /** Nunca hubo sesión de Microsoft en esta máquina. */
  | { status: 'none' }
  /** La red falló; se conserva el refresh token para volver a intentar. */
  | { status: 'unavailable' }

export function clearRefreshToken(): void {
  if (existsSync(msTokenPath())) rmSync(msTokenPath())
}

async function toSession(xbox: Awaited<ReturnType<Auth['launch']>>): Promise<PremiumSession> {
  const minecraft = await xbox.getMinecraft()
  if (!minecraft.profile) {
    throw new Error('Esta cuenta de Microsoft no tiene Minecraft: Java Edition.')
  }
  saveRefreshToken(xbox.save())
  return {
    name: minecraft.profile.name,
    uuid: minecraft.profile.id,
    mcToken: minecraft.mcToken,
    mclc: minecraft.mclc()
  }
}

/**
 * El código de error de msmc, sin nada más: msmc lanza el código suelto («error.auth.xsts.userNotFound») o un objeto
 * `{ response, ts }` cuando una respuesta HTTP vino mal. Nunca un `Error`.
 */
export function codigoMsmc(error: unknown): { codigo: string | null; estado: number | null } {
  if (typeof error === 'string' && /^error\.[A-Za-z0-9.]+$/.test(error)) return { codigo: error, estado: null }
  if (error && typeof error === 'object') {
    const e = error as { ts?: unknown; response?: { status?: unknown } }
    const codigo = typeof e.ts === 'string' && /^error\.[A-Za-z0-9.]+$/.test(e.ts) ? e.ts : null
    const estado = typeof e.response?.status === 'number' ? e.response.status : null
    if (codigo || estado) return { codigo, estado }
  }
  return { codigo: null, estado: null }
}

/**
 * Lo que se le dice al jugador cuando Microsoft, Xbox o Minecraft no lo dejan entrar (23-10-2026). Antes el error de
 * msmc se pasaba tal cual por el IPC y, como no es un `Error`, la pantalla mostraba «Error invoking remote method
 * 'auth:microsoft-login': [object Object]», sin decir qué pasó.
 */
export function mensajeMicrosoft(error: unknown): string {
  const { codigo, estado } = codigoMsmc(error)
  const ref = codigo ? ` (${codigo}${estado ? ` · ${estado}` : ''})` : estado ? ` (HTTP ${estado})` : ''
  if (estado === 429) return 'Demasiados intentos seguidos. Esperá unos minutos y volvé a probar.' + ref
  switch (codigo) {
    case 'error.gui.closed':
      return 'Se cerró la ventana de Microsoft antes de terminar el inicio de sesión.'
    case 'error.auth.xsts.userNotFound':
      return 'Tu cuenta de Microsoft todavía no tiene perfil de Xbox. Entrá una vez a xbox.com con esa cuenta, creá el perfil y volvé a intentar.' + ref
    case 'error.auth.xsts.child':
    case 'error.auth.xsts.child.SK':
      return 'La cuenta es de un menor: un adulto tiene que agregarla a su familia de Microsoft para poder jugar.' + ref
    case 'error.auth.xsts.bannedCountry':
      return 'Xbox Live no está disponible en el país de esa cuenta de Microsoft.' + ref
    case 'error.auth.minecraft.profile':
      return 'Esa cuenta de Microsoft no tiene Minecraft: Java Edition, o todavía no eligió su nombre en minecraft.net. Si no tenés Minecraft original, usá CREAR CUENTA.' + ref
    case 'error.auth.minecraft.entitlements':
      return 'No se pudo comprobar si la cuenta tiene Minecraft. Volvé a intentar en un rato.' + ref
    case 'error.auth.minecraft.login':
      return 'Minecraft no aceptó el inicio de sesión de Xbox. Volvé a intentar en un rato.' + ref
    case 'error.auth.microsoft':
      return 'Microsoft no aceptó el inicio de sesión. Volvé a intentar.' + ref
  }
  if (codigo?.startsWith('error.auth.xboxLive') || codigo?.startsWith('error.auth.xsts')) {
    return 'Xbox Live no dejó entrar con esa cuenta. Volvé a intentar en un rato.' + ref
  }
  if (error instanceof Error && error.message) return error.message
  return 'No se pudo entrar con Microsoft' + (ref || ' (error desconocido)') + '. Volvé a intentar; si sigue, pasale este mensaje a soporte.'
}

export async function loginMicrosoft(): Promise<PremiumSession> {
  const auth = new Auth('select_account')
  let stage = 'microsoft_window'
  auth.on('load', (code: string) => { if (/^load\.auth\.[A-Za-z0-9.]+$/.test(code)) stage = code })
  try {
    const xbox = await auth.launch('electron')
    return await toSession(xbox)
  } catch (error) {
    // el código de msmc va en la etapa: no es un dato de la cuenta y es lo único que dice qué pasó
    const { codigo, estado } = codigoMsmc(error)
    logNetwork('microsoft', [stage, codigo, estado].filter(Boolean).join(':'), error)
    if (isNetworkError(error)) {
      throw new Error('No se pudo completar la conexión con Microsoft, Xbox o Minecraft. Volvé a intentar. Si continúa, compartí conexion-launcher.log con soporte.')
    }
    // siempre un Error: cualquier otra cosa llega a la pantalla como «[object Object]»
    throw new Error(mensajeMicrosoft(error))
  }
}

/**
 * Re-login silencioso al abrir el launcher.
 *
 * <p>Distingue "no hay sesión" de "había una y ya no sirve", y esa diferencia
 * importa: cuando falla, el launcher tiene que <b>decirlo</b> y pedir que se
 * entre de nuevo. Antes devolvía null en los dos casos y la pantalla firmaba en
 * modo offline con el nick guardado. Como el nick guardado suele ser el mismo
 * nombre premium, la sesión se veía idéntica — mismo nombre, mismo todo — pero
 * el juego arrancaba sin sesión real.
 *
 * <p>Eso deja al jugador sin skin y sin poder entrar a ningún servidor que pida
 * autenticación premium, con un "Invalid session" que no menciona el launcher
 * por ningún lado.
 */
export async function restoreMicrosoft(): Promise<RestoreResult> {
  const habia = hasSavedSession()
  const refreshToken = readRefreshToken()
  if (!refreshToken) {
    // El archivo existe pero no se pudo leer: la sesión está, rota. No es lo
    // mismo que no tener ninguna.
    return habia ? { status: 'expired' } : { status: 'none' }
  }
  try {
    const auth = new Auth('select_account')
    const xbox = await auth.refresh(refreshToken)
    return { status: 'ok', session: await toSession(xbox) }
  } catch (error) {
    logNetwork('microsoft', 'restore', error)
    // Una interrupción de red no revoca la sesión guardada.
    if (isNetworkError(error)) return { status: 'unavailable' }
    clearRefreshToken()
    return { status: 'expired' }
  }
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:microsoft-login', () => loginMicrosoft())
  ipcMain.handle('auth:microsoft-restore', () => restoreMicrosoft())
  ipcMain.handle('auth:microsoft-logout', () => {
    clearRefreshToken()
    return true
  })
}
