import { useEffect, useLayoutEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Button from './Button'
import ConfigGuiada from './ConfigGuiada'
import type { NavKey } from './SideNav'

/**
 * El recorrido del launcher, marcando la interfaz de verdad.
 *
 * Va encima del launcher real y no en una pantalla aparte con capturas: una
 * captura queda vieja con el primer cambio de diseño, y lo que se aprende
 * señalando el botón de verdad se encuentra después sin buscarlo.
 *
 * Cada paso apunta a un elemento con `data-recorrido="<clave>"` y cambia de
 * sección si hace falta, para que lo marcado esté a la vista. Al final abre la
 * configuración guiada.
 */

interface PasoRecorrido {
  objetivo: string
  seccion?: NavKey
  titulo: string
  texto: string
}

const PASOS: PasoRecorrido[] = [
  {
    objetivo: 'jugar',
    seccion: 'play',
    titulo: 'JUGAR hace todo',
    texto:
      'Instala o repara el modpack, prepara Forge y abre Minecraft ya conectado a Victoria. No hace falta escribir /login: tu cuenta entra sola.'
  },
  {
    objetivo: 'play',
    titulo: 'Inicio',
    texto: 'Novedades del servidor, el estado del modpack y el botón para jugar.'
  },
  {
    objetivo: 'mods',
    titulo: 'Mods',
    texto: 'Los mods opcionales: extras de rendimiento y visuales que podés prender o apagar sin romper nada.'
  },
  {
    objetivo: 'shaders',
    titulo: 'Shaders',
    texto: 'Luces y sombras realistas. Consumen mucho: si el juego va lento, este es el primer lugar para mirar.'
  },
  {
    objetivo: 'settings',
    titulo: 'Ajustes',
    texto:
      'Memoria del juego, tu cuenta, cerrar sesión y volver a ver este tutorial. Si el juego se cierra, acá ves por qué.'
  }
]

export interface RecorridoProps {
  onIr: (seccion: NavKey) => void
  /** Terminó todo (recorrido + configuración). */
  onListo: () => void
}

export default function Recorrido({ onIr, onListo }: RecorridoProps): JSX.Element {
  const [i, setI] = useState(0)
  const [caja, setCaja] = useState<DOMRect | null>(null)
  const [configurando, setConfigurando] = useState(false)
  const paso = PASOS[i]

  useEffect(() => {
    if (paso?.seccion) onIr(paso.seccion)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  // Se vuelve a medir mientras dura el paso: la sección nueva entra animada y
  // la ventana se puede agrandar.
  useLayoutEffect(() => {
    if (configurando || !paso) return
    let cuadro = 0
    const medir = (): void => {
      const el = document.querySelector(`[data-recorrido="${paso.objetivo}"]`)
      setCaja(el ? el.getBoundingClientRect() : null)
      cuadro = requestAnimationFrame(medir)
    }
    medir()
    return () => cancelAnimationFrame(cuadro)
  }, [i, configurando, paso])

  if (configurando) return <ConfigGuiada onListo={onListo} />

  const margen = 8
  const tarjetaIzquierda = caja ? Math.min(window.innerWidth - 360, caja.right + 18) : window.innerWidth / 2 - 170
  const tarjetaArriba = caja ? Math.max(50, Math.min(window.innerHeight - 220, caja.top - 10)) : window.innerHeight / 2 - 100

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55 }}>
      {/* El oscurecido es una sombra enorme alrededor del recuadro: así lo
          marcado queda iluminado sin tener que recortar nada. */}
      <motion.div
        animate={
          caja
            ? { left: caja.left - margen, top: caja.top - margen, width: caja.width + margen * 2, height: caja.height + margen * 2 }
            : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 }
        }
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        style={{
          position: 'fixed',
          borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(7,7,11,0.72)',
          border: '2px solid var(--gold)',
          pointerEvents: 'none'
        }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="panel"
          style={{ position: 'fixed', left: tarjetaIzquierda, top: tarjetaArriba, width: 340, padding: 18, display: 'grid', gap: 10 }}
        >
          <p className="eyebrow" style={{ margin: 0 }}>
            Paso 4 de 5 · {i + 1}/{PASOS.length}
          </p>
          <h3 style={{ margin: 0, fontSize: 17 }}>{paso.titulo}</h3>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-dim)' }}>{paso.texto}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {i > 0 && (
              <Button variant="ghost" onClick={() => setI(i - 1)}>
                Atrás
              </Button>
            )}
            <Button onClick={() => (i + 1 < PASOS.length ? setI(i + 1) : setConfigurando(true))}>
              {i + 1 < PASOS.length ? 'Siguiente' : 'Configurar mi PC'}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
