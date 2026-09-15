import { ipcMain, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { Auth } from 'msmc'
// msmc's package.json `exports` map only exposes ".", so the deep path
// 'msmc/types/types' does not resolve. The same type is reachable through the
// `types` namespace that msmc re-exports from its entry point.
import type { types } from 'msmc'
import { msTokenPath, victoriaPasswordPath } from '../lib/paths'

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

export function clearRefreshToken(): void {
  if (existsSync(msTokenPath())) rmSync(msTokenPath())
}

/**
 * La contrasenia de Victoria (la de AuthMe), guardada con el llavero del sistema.
 *
 * Es el mismo mecanismo que el token de Microsoft, y por el mismo motivo: para
 * no volver a pedirsela. La diferencia es que esto SI es una contrasenia --el
 * token de Microsoft es un vale renovable-- asi que si el llavero no esta
 * disponible **no se guarda nada** y se le pide cada vez. Escribir una
 * contrasenia en claro en el disco del jugador para ahorrarle un tipeo no vale
 * la pena.
 */
export function saveVictoriaPassword(contrasena: string): void {
  if (!safeStorage.isEncryptionAvailable()) return
  try {
    writeFileSync(victoriaPasswordPath(), safeStorage.encryptString(contrasena))
  } catch {
    // Recordar la contrasenia es una comodidad. Un disco lleno no puede
    // convertir un inicio de sesion que ya salio bien en un error.
  }
}

export function readVictoriaPassword(): string | null {
  if (!existsSync(victoriaPasswordPath())) return null
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(readFileSync(victoriaPasswordPath()))
  } catch {
    return null
  }
}

export function clearVictoriaPassword(): void {
  if (existsSync(victoriaPasswordPath())) rmSync(victoriaPasswordPath())
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

export async function loginMicrosoft(): Promise<PremiumSession> {
  const auth = new Auth('select_account')
  const xbox = await auth.launch('electron')
  return toSession(xbox)
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
  } catch {
    clearRefreshToken()
    return { status: 'expired' }
  }
}

export function registerAuthHandlers(): void {
  /**
   * Si hace falta pedirle la contrasenia de Victoria al jugador.
   *
   * Dos condiciones: que el servidor de autenticacion este configurado en el
   * manifiesto --si no, todo esto esta apagado y pedirla seria pedir algo que no
   * se usa-- y que no haya ninguna guardada.
   *
   * Ante cualquier duda contesta false: no pedirla cuando habria que pedirla
   * cuesta que el jugador escriba `/login` una vez; pedirla cuando no hace falta
   * es un formulario que aparece sin motivo y no se puede sacar de encima.
   */
  ipcMain.handle('auth:needs-victoria-password', async () => {
    if (readVictoriaPassword()) return false
    try {
      const { fetchManifest } = await import('./sync')
      const manifest = await fetchManifest()
      return manifest.auth !== undefined
    } catch {
      return false
    }
  })
  ipcMain.handle('auth:forget-victoria-password', () => {
    clearVictoriaPassword()
    return true
  })
  ipcMain.handle('auth:microsoft-login', () => loginMicrosoft())
  ipcMain.handle('auth:microsoft-restore', () => restoreMicrosoft())
  ipcMain.handle('auth:microsoft-logout', () => {
    clearRefreshToken()
    return true
  })
}
