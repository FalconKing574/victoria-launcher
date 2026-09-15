import { createHash, randomUUID } from 'crypto'

/**
 * La huella del equipo: con qué PC entra cada cuenta.
 *
 * Sirve para que un ban alcance a la persona y no sólo al nombre: el que crea
 * otra cuenta desde la misma PC sigue afuera. Sale del `MachineGuid` de Windows,
 * que se crea al instalar el sistema y no cambia con reiniciar el módem.
 *
 * Se manda el hash y no el GUID: el servidor sólo necesita comparar, no saber
 * qué PC es. Y se le suma "victoria:" para que el mismo hash no sirva para
 * cruzar datos con otro sistema que también use el MachineGuid.
 *
 * No es inviolable: el GUID se puede cambiar en el registro. Sube la vara, no
 * la cierra; por eso el ban también mira Discord, correo e IP.
 */

export function huellaDe(identificador: string): string {
  return createHash('sha256')
    .update(`victoria:${identificador.trim().toLowerCase()}`)
    .digest('hex')
}

export function leerMachineGuid(salidaReg: string): string | null {
  const m = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{36})/.exec(salidaReg)
  return m ? m[1] : null
}

export interface DependenciasHuella {
  /** `reg query HKLM\SOFTWARE\Microsoft\Cryptography /v MachineGuid /reg:64` */
  regQuery: () => Promise<string>
  leerRespaldo: () => string | null
  guardarRespaldo: (id: string) => void
}

/**
 * La huella de esta PC.
 *
 * Si el registro no se puede leer (una política de la empresa, un antivirus),
 * se usa un id al azar guardado en la carpeta del launcher. Es peor —se borra
 * reinstalando el launcher— pero es mejor que no mandar nada, y el servidor no
 * deja jugar sin huella.
 */
export async function obtenerHuella(deps: DependenciasHuella): Promise<string> {
  try {
    const guid = leerMachineGuid(await deps.regQuery())
    if (guid) return huellaDe(guid)
  } catch {
    // Sigue con el respaldo.
  }
  let id = deps.leerRespaldo()
  if (!id) {
    id = randomUUID()
    deps.guardarRespaldo(id)
  }
  return huellaDe(id)
}
