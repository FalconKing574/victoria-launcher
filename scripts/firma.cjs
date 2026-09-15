/**
 * El "sign hook" de electron-builder para firmar con SignPath.
 *
 * ## Por qué no firma acá
 *
 * SignPath Foundation (firma gratis para código abierto) sólo firma lo que llega
 * por su acción de GitHub, subido como artefacto del workflow: así prueba que el
 * binario salió de este repo y no de la PC de alguien. Un hook no puede subir un
 * artefacto a mitad del build, así que el workflow firma en dos vueltas
 * (`.github/workflows/release.yml`) y este hook tiene tres modos:
 *
 * - `FIRMA_MODO=recolectar`: copia cada archivo que electron-builder quiere
 *   firmar a `FIRMA_DIR` (por su nombre) y no toca nada. De acá sale el
 *   desinstalador, que electron-builder genera y mete adentro del instalador en
 *   el mismo paso: sin este modo quedaría sin firmar, y un .exe sin firmar en la
 *   carpeta de instalación es lo que más termina marcando algún antivirus.
 * - `FIRMA_MODO=reemplazar`: si en `FIRMA_DIR` hay una copia firmada con ese
 *   nombre, la pone en lugar del archivo. El instalador que se arma después ya
 *   lleva adentro el desinstalador firmado.
 * - sin `FIRMA_MODO` (build local): no hace nada. El build local sigue saliendo
 *   sin firmar, como siempre.
 *
 * El nombre del archivo alcanza como clave: en un build hay un solo
 * `Victoria Kingdom.exe`, un solo `__uninstaller-nsis-*.exe`, etc.
 */
const { copyFileSync, existsSync, mkdirSync } = require('fs')
const { basename, join } = require('path')

module.exports = async function firmar(configuracion) {
  const modo = process.env.FIRMA_MODO
  const dir = process.env.FIRMA_DIR
  if (!modo) return
  if (!dir) throw new Error('FIRMA_MODO sin FIRMA_DIR')
  const nombre = basename(configuracion.path)

  if (modo === 'recolectar') {
    mkdirSync(dir, { recursive: true })
    copyFileSync(configuracion.path, join(dir, nombre))
    console.log(`  [firma] recolectado: ${nombre}`)
    return
  }

  if (modo === 'reemplazar') {
    const firmado = join(dir, nombre)
    if (existsSync(firmado)) {
      copyFileSync(firmado, configuracion.path)
      console.log(`  [firma] reemplazado por la copia firmada: ${nombre}`)
    } else {
      console.log(`  [firma] sin copia firmada (se firma después): ${nombre}`)
    }
    return
  }

  throw new Error(`FIRMA_MODO desconocido: ${modo}`)
}
