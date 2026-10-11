import { describe, expect, it } from 'vitest'
import { isNetworkError, networkCodes } from '../src/main/lib/network-error'

describe('diagnóstico de conexión sin datos de autenticación', () => {
  it('identifica causas anidadas de DNS y conexiones múltiples', () => {
    const error = new TypeError('fetch failed', { cause: new AggregateError([
      Object.assign(new Error('token=SECRETO'), { code: 'ENETUNREACH' }),
      Object.assign(new Error('otro detalle'), { code: 'ETIMEDOUT' })
    ]) })
    expect(isNetworkError(error)).toBe(true)
    expect(networkCodes(error)).toContain('ENETUNREACH')
    expect(networkCodes(error)).toContain('ETIMEDOUT')
    expect(JSON.stringify(networkCodes(error))).not.toContain('SECRETO')
  })
  it('no confunde una cuenta sin licencia con un fallo de red', () => {
    expect(isNetworkError(new Error('Esta cuenta no tiene Minecraft: Java Edition.'))).toBe(false)
  })
  it('no copia códigos con URLs o valores arbitrarios y tolera ciclos', () => {
    const error = { code: 'https://example.test/?token=SECRETO', cause: {} }
    error.cause = error
    expect(networkCodes(error)).toEqual([])
  })
})
