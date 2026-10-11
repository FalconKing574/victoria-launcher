import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ launch: vi.fn(), refresh: vi.fn(), remove: vi.fn(), log: vi.fn() }))
vi.mock('electron', () => ({ app: { getPath: () => 'Z:/victoria-test-inexistente' }, ipcMain: { handle: vi.fn() },
  safeStorage: { isEncryptionAvailable: () => true, decryptString: () => 'refresh-de-prueba', encryptString: () => Buffer.from('cifrado') }
}))
vi.mock('fs', () => ({ existsSync: () => true, readFileSync: () => Buffer.from('cifrado'), writeFileSync: vi.fn(), rmSync: mock.remove }))
vi.mock('../src/main/lib/network-log', () => ({ logNetwork: mock.log }))
vi.mock('msmc', async () => {
  const { EventEmitter } = await import('events')
  return { Auth: class extends EventEmitter {
    launch(): Promise<unknown> { this.emit('load', 'load.auth.xboxLive.1'); return mock.launch() }
    refresh(): Promise<unknown> { return mock.refresh() }
  } }
})
beforeEach(() => { vi.clearAllMocks() })

describe('los fallos de red no destruyen la sesión de Microsoft', () => {
  it('conserva el refresh token ante una desconexión', async () => {
    mock.refresh.mockRejectedValue(new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }))
    const { restoreMicrosoft } = await import('../src/main/ipc/auth')
    expect(await restoreMicrosoft()).toEqual({ status: 'unavailable' })
    expect(mock.remove).not.toHaveBeenCalled()
  })
  it('sí descarta una sesión rechazada por Microsoft', async () => {
    mock.refresh.mockRejectedValue(new Error('invalid_grant'))
    const { restoreMicrosoft } = await import('../src/main/ipc/auth')
    expect(await restoreMicrosoft()).toEqual({ status: 'expired' })
    expect(mock.remove).toHaveBeenCalledOnce()
  })
  it('un fallo al entrar explica el servicio y registra la etapa sin el texto de OAuth', async () => {
    const error = Object.assign(new Error('request to https://example.test/?token=SECRETO failed'), { code: 'ECONNRESET' })
    mock.launch.mockRejectedValue(error)
    const { loginMicrosoft } = await import('../src/main/ipc/auth')
    await expect(loginMicrosoft()).rejects.toThrow('Microsoft, Xbox o Minecraft')
    expect(mock.log).toHaveBeenCalledWith('microsoft', 'load.auth.xboxLive.1', error)
  })
  it('cerrar la ventana de Microsoft tiene un aviso propio', async () => {
    mock.launch.mockRejectedValue('error.gui.closed')
    const { loginMicrosoft } = await import('../src/main/ipc/auth')
    await expect(loginMicrosoft()).rejects.toThrow('Se cerró la ventana de Microsoft')
  })
})
