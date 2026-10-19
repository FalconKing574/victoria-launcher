import { net } from 'electron'
import { MANIFEST_URL } from '../config'
import { createManifestClient } from './manifest-client'
import { logNetwork } from './network-log'

// Chromium respeta la red del sistema (incluidos proxies). Node ofrece un
// segundo transporte independiente si el primero falla. Nunca se omite TLS.
export const loadManifest = createManifestClient({
  url: MANIFEST_URL,
  fetchers: [(url, init) => net.fetch(url instanceof URL ? url.href : url, init), (url, init) => fetch(url, init)],
  failure: (stage, error) => logNetwork('manifest', stage, error)
})
