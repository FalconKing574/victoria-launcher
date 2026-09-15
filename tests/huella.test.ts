import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { huellaDe, leerMachineGuid, obtenerHuella } from '../src/main/lib/huella'

const SALIDA_REG = `
HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography
    MachineGuid    REG_SZ    3F2504E0-4F89-11D3-9A0C-0305E82C3301
`

describe('huella', () => {
  it('es el sha256 de victoria:<id> en minúsculas', () => {
    const esperado = createHash('sha256')
      .update('victoria:3f2504e0-4f89-11d3-9a0c-0305e82c3301')
      .digest('hex')
    expect(huellaDe('3F2504E0-4F89-11D3-9A0C-0305E82C3301')).toBe(esperado)
    expect(huellaDe(' 3f2504e0-4f89-11d3-9a0c-0305e82c3301 ')).toBe(esperado)
  })

  it('saca el MachineGuid de la salida de reg', () => {
    expect(leerMachineGuid(SALIDA_REG)).toBe('3F2504E0-4F89-11D3-9A0C-0305E82C3301')
    expect(leerMachineGuid('ERROR: no se encontró')).toBeNull()
  })

  it('usa el MachineGuid cuando está', async () => {
    const h = await obtenerHuella({
      regQuery: async () => SALIDA_REG,
      leerRespaldo: () => 'no-deberia-usarse',
      guardarRespaldo: () => {
        throw new Error('no debería guardar')
      }
    })
    expect(h).toBe(huellaDe('3F2504E0-4F89-11D3-9A0C-0305E82C3301'))
  })

  it('cae al respaldo si reg falla', async () => {
    const h = await obtenerHuella({
      regQuery: async () => {
        throw new Error('reg no está')
      },
      leerRespaldo: () => 'id-guardado',
      guardarRespaldo: () => undefined
    })
    expect(h).toBe(huellaDe('id-guardado'))
  })

  it('crea el respaldo si no hay ninguno', async () => {
    let guardado: string | null = null
    const h = await obtenerHuella({
      regQuery: async () => 'sin guid',
      leerRespaldo: () => null,
      guardarRespaldo: (id) => {
        guardado = id
      }
    })
    expect(guardado).not.toBeNull()
    expect(h).toBe(huellaDe(guardado!))
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
})
