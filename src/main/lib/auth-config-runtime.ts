import { app } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { MANIFEST_URL } from '../config'
import bootstrap from '../data/auth-respaldo.json'
import { createAuthConfig } from './auth-config'
import { loadManifest } from './manifest-runtime'
import { logNetwork } from './network-log'
import { writeJsonAtomic } from './write-atomic'

const production = 'https://pub-71a914f3c2c84bc2ab56e0b651560b55.r2.dev/manifest.json'
const file = (): string => join(app.getPath('userData'), 'cuentas-config.json')
export const getAuthConfig = createAuthConfig({
  url: MANIFEST_URL,
  loadManifest,
  read: () => existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : null,
  write: (value) => writeJsonAtomic(file(), value),
  // Nunca enviar credenciales a producción si se configuró otro servidor.
  bootstrap: MANIFEST_URL === production ? bootstrap : undefined,
  failure: (stage, error) => logNetwork('auth_config', stage, error)
})
