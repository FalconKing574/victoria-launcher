import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { UpdaterPhase, UpdaterState } from '@shared/api'
import ProgressBar from '../components/ProgressBar'
import { decidirSplash, puedeSaltar } from '../lib/arranque'
import logo from '../assets/logo.png'

/**
 * La pantalla de carga. Además del logo, es donde el launcher se actualiza a sí
 * mismo: si hay versión nueva se baja e instala desde acá, antes de que el
 * jugador empiece nada, y el launcher se vuelve a abrir solo. Las reglas de
 * cuándo esperar y cuándo entrar están en `lib/arranque.ts`.
 */
export default function Splash({ onDone }: { onDone: () => void }): JSX.Element {
  const [estado, setEstado] = useState<UpdaterState | null>(null)
  const [ms, setMs] = useState(0)
  const salio = useRef(false)
  const marcaFase = useRef<{ fase: UpdaterPhase | null; desde: number }>({ fase: null, desde: 0 })

  useEffect(() => {
    const off = window.api.updater.onState(setEstado)
    // Un evento que llegue antes que esta respuesta es más nuevo: gana él.
    window.api.updater
      .state()
      .then((actual) => setEstado((previo) => previo ?? actual))
      .catch(() => undefined)
    return off
  }, [])

  useEffect(() => {
    const inicio = Date.now()
    const reloj = setInterval(() => setMs(Date.now() - inicio), 200)
    return () => clearInterval(reloj)
  }, [])

  const fase = estado?.phase ?? null
  if (marcaFase.current.fase !== fase) marcaFase.current = { fase, desde: ms }
  const msEnFase = ms - marcaFase.current.desde

  const decision = decidirSplash(fase, ms)

  const entrar = useCallback((): void => {
    if (salio.current) return
    salio.current = true
    // Desde acá, lo que se baje se instala al cerrar el launcher y no corta
    // lo que el jugador esté haciendo.
    void window.api.updater.posponer().catch(() => undefined)
    onDone()
  }, [onDone])

  useEffect(() => {
    if (decision === 'entrar') entrar()
  }, [decision, entrar])

  const version = estado?.version ?? null
  const instalando = fase === 'ready' || fase === 'installing'

  return (
    <motion.div
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.5 } }}
      style={{
        // Debajo de la barra de título, no encima: la ventana no tiene marco, y
        // con una descarga larga en pantalla tiene que poder moverse, minimizarse
        // y cerrarse. Cuando el splash duraba 2 segundos daba igual taparla.
        position: 'fixed',
        top: 'var(--titlebar-h)',
        left: 0,
        right: 0,
        bottom: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bg-0)',
        zIndex: 100
      }}
    >
      <div style={{ display: 'grid', justifyItems: 'center', gap: 26 }}>
        <motion.img
          src={logo}
          alt="Victoria Kingdom"
          initial={{ opacity: 0, scale: 0.86, filter: 'blur(14px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: 360, imageRendering: 'pixelated' }}
        />

        {decision !== 'actualizar' ? (
          <div style={{ display: 'grid', justifyItems: 'center', gap: 12 }}>
            <BarraIndeterminada ancho={220} />
            <div style={{ minHeight: 16, fontSize: 12, color: 'var(--text-faint)' }}>
              {fase === 'checking' && ms > 1200 ? 'Buscando actualizaciones...' : ''}
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ width: 380, display: 'grid', gap: 12, textAlign: 'center' }}
          >
            {instalando ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  Instalando la versión {version ?? 'nueva'}...
                </div>
                <BarraIndeterminada ancho={380} />
                <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>
                  El launcher se va a cerrar y se vuelve a abrir solo en unos segundos.
                  <br />
                  No hace falta que hagas nada.
                </div>
                {estado?.message && (
                  <div style={{ fontSize: 12, color: 'var(--gold-bright)', lineHeight: 1.55 }}>
                    {estado.message}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  Actualizando el launcher{version ? ` a la versión ${version}` : ''}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <ProgressBar
                    percent={estado?.percent ?? 0}
                    label={fase === 'available' ? 'Preparando la descarga...' : 'Descargando...'}
                  />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.55 }}>
                  Se instala sola y el launcher se vuelve a abrir. No tienes que instalar nada.
                </div>
              </>
            )}

            {puedeSaltar(fase, msEnFase) && (
              <div style={{ display: 'grid', justifyItems: 'center', gap: 6, marginTop: 4 }}>
                <button
                  onClick={entrar}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 9,
                    border: '1px solid var(--stroke-strong)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text)',
                    fontSize: 12.5,
                    cursor: 'pointer'
                  }}
                >
                  Entrar sin esperar
                </button>
                <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                  La actualización se instalará cuando cierres el launcher.
                </span>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

function BarraIndeterminada({ ancho }: { ancho: number }): JSX.Element {
  return (
    <div
      style={{
        width: ancho,
        height: 3,
        borderRadius: 99,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden'
      }}
    >
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
        style={{
          height: '100%',
          width: '55%',
          background: 'linear-gradient(90deg, transparent, var(--gold), transparent)'
        }}
      />
    </div>
  )
}
