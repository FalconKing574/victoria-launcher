import { ipcMain, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { Auth } from 'msmc'
// msmc's package.json `exports` map only exposes ".", so the deep path
// 'msmc/types/types' does not resolve. The same type is reachable through the
// `types` namespace that msmc re-exports from its entry point.
import type { types } from 'msmc'
import { msTokenPath } from '../lib/paths'

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
  writeFileSync(msTokenPath(), safeStorage.encryptString(token))
}

function readRefreshToken(): string | null {
  if (!existsSync(msTokenPath()) || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(readFileSync(msTokenPath()))
  } catch {
    return null
  }
}

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

export async function loginMicrosoft(): Promise<PremiumSession> {
  const auth = new Auth('select_account')
  const xbox = await auth.launch('electron')
  return toSession(xbox)
}

/** Silent re-login on startup. Returns null when there is no usable token. */
export async function restoreMicrosoft(): Promise<PremiumSession | null> {
  const refreshToken = readRefreshToken()
  if (!refreshToken) return null
  try {
    const auth = new Auth('select_account')
    const xbox = await auth.refresh(refreshToken)
    return await toSession(xbox)
  } catch {
    clearRefreshToken()
    return null
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
