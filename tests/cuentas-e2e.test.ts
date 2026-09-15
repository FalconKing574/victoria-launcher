import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { llamar, type AuthManifest } from '../src/main/lib/cuentas-api'

/**
 * Contra un VictoriaAuth de verdad. Apagado por defecto: hace falta el servidor
 * local de VictoriaRP arrancado (`server/start.bat`).
 *
 *     VICTORIA_E2E=1 npx vitest run tests/cuentas-e2e.test.ts
 *
 * Lee la llave del servidor local, así que prueba el sobre Node → Java por la
 * red real, no contra un doble.
 */
const LLAVE = join(__dirname, '..', '..', 'VictoriaRP', 'server', 'plugins', 'VictoriaAuth', 'llave.pub')
const HUELLA = 'e'.repeat(64)

describe.runIf(process.env.VICTORIA_E2E === '1' && existsSync(LLAVE))('VictoriaAuth local', () => {
  const auth: AuthManifest = { host: '127.0.0.1', puerto: 25568, llave: readFileSync(LLAVE, 'utf8').trim() }

  it('entrar con una cuenta que no existe contesta credenciales', async () => {
    const r = await llamar(auth, 'entrar', { nombre: 'NadieE2E', contrasena: 'claveSegura1', huella: HUELLA })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('credenciales')
  })

  it('una sesión inventada contesta sesion', async () => {
    const r = await llamar(auth, 'cuenta', { sesion: 'inventada', huella: HUELLA })
    expect(r.error).toBe('sesion')
  })

  it('un token de Minecraft falso no crea cuenta premium', async () => {
    const r = await llamar(auth, 'premium', { mcToken: 'token-falso', huella: HUELLA })
    expect(['premium_invalido', 'mojang_caido']).toContain(r.error)
  })

  it('registrar llega hasta el correo (sin SMTP configurado, correo_caido)', async () => {
    const r = await llamar(auth, 'registrar', {
      nombre: 'PruebaE2E' + Math.floor(Math.random() * 1000),
      contrasena: 'claveSegura1',
      correo: `e2e${Date.now()}@ejemplo.com`,
      huella: HUELLA
    })
    expect(['correo_caido', 'mojang_caido']).toContain(r.error)
  }, 20_000)
})
