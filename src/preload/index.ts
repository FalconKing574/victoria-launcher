import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { VictoriaApi } from './api'

/** Subscribes to a main-process event and returns an unsubscribe function. */
function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: VictoriaApi = {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url)
  },
  auth: {
    microsoftLogin: () => ipcRenderer.invoke('auth:microsoft-login'),
    microsoftRestore: () => ipcRenderer.invoke('auth:microsoft-restore'),
    microsoftLogout: () => ipcRenderer.invoke('auth:microsoft-logout')
  },
  access: {
    checkPremium: (mcToken) => ipcRenderer.invoke('supabase:check-access-premium', mcToken),
    checkOffline: (username) => ipcRenderer.invoke('supabase:check-access-offline', username)
  },
  mods: {
    list: () => ipcRenderer.invoke('mods:list'),
    toggle: (filename, enable) => ipcRenderer.invoke('mods:toggle', filename, enable)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (patch) => ipcRenderer.invoke('settings:save', patch)
  },
  launch: {
    start: (request) => ipcRenderer.invoke('launch:start', request),
    isRunning: () => ipcRenderer.invoke('launch:is-running'),
    onProgress: (cb) => on('launch:progress', cb),
    onStatus: (cb) => on('launch:status', cb),
    onError: (cb) => on('launch:error', cb),
    onClosed: (cb) => on('launch:closed', cb)
  }
}

contextBridge.exposeInMainWorld('api', api)
