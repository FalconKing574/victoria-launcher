import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import AmbientMusic from './components/AmbientMusic'
import TitleBar from './components/TitleBar'
import PanoramaBg from './components/PanoramaBg'
import SideNav, { type NavKey } from './components/SideNav'
import Recorrido from './components/Recorrido'
import Sancion from './components/Sancion'
import Splash from './screens/Splash'
import Cuenta from './screens/Cuenta'
import Pasos from './screens/Pasos'
import Home from './screens/Home'
import Modpack from './screens/Modpack'
import Shaders from './screens/Shaders'
import Settings from './screens/Settings'
import type { EstadoCuenta, PremiumSession, RespuestaCuenta, SancionInfo } from '@shared/api'

/**
 * Las etapas del launcher desde las cuentas de Victoria.
 *
 * ```
 * splash → cuenta (entrar / crear) → pasos (Discord, normas) → app (+ recorrido la primera vez)
 * ```
 *
 * Quién decide qué falta es el servidor: `cuenta.pasos` viene en cada respuesta.
 * El launcher sólo muestra la pantalla del primer paso pendiente.
 */
type Stage = 'splash' | 'cuenta' | 'pasos' | 'app'

export default function App(): JSX.Element {
  const [stage, setStage] = useState<Stage>('splash')
  const [cuenta, setCuenta] = useState<EstadoCuenta | null>(null)
  const [premium, setPremium] = useState<PremiumSession | undefined>(undefined)
  const [sancion, setSancion] = useState<SancionInfo | null>(null)
  const [nav, setNav] = useState<NavKey>('play')
  const [recorrido, setRecorrido] = useState(false)
  const [sesionVencida, setSesionVencida] = useState(false)
  const [servidorCaido, setServidorCaido] = useState(false)

  /** Pone la cuenta y va a la etapa que corresponde según lo que le falte. */
  const aplicar = useCallback((r: RespuestaCuenta, sesionMicrosoft?: PremiumSession): void => {
    if (r.sancion) setSancion(r.sancion)
    if (!r.cuenta) {
      if (r.sancion) setStage('cuenta')
      return
    }
    setCuenta(r.cuenta)
    if (sesionMicrosoft) setPremium(sesionMicrosoft)
    const pendientes = r.cuenta.pasos
    if (pendientes.includes('discord') || pendientes.includes('normas')) {
      setStage('pasos')
      return
    }
    setStage('app')
    if (pendientes.includes('tutorial')) {
      setNav('play')
      setRecorrido(true)
    }
  }, [])

  // Al abrir: primero Microsoft (hace falta para lanzar a un premium), después
  // la sesión de Victoria. Un premium sin sesión de Victoria entra solo con su
  // token de Minecraft; un no premium sin sesión va a la pantalla de cuenta.
  const arrancar = useCallback(async (): Promise<void> => {
    setServidorCaido(false)
    const ms = await window.api.auth.microsoftRestore().catch(() => ({ status: 'expired' }) as const)
    const sesionMs = ms.status === 'ok' ? ms.session : undefined

    let r = await window.api.cuentas.estado()
    if (!r.ok && r.error === 'sesion' && sesionMs) {
      r = await window.api.cuentas.premium(sesionMs.mcToken)
    }
    if (r.ok && r.cuenta) {
      if (r.cuenta.tipo === 'PREMIUM' && !sesionMs) {
        // Cuenta premium pero la sesión de Microsoft venció: sin ella el juego
        // arrancaría sin skin y FastLogin lo rechazaría al entrar.
        setSesionVencida(ms.status === 'expired')
        setStage('cuenta')
        return
      }
      aplicar(r, sesionMs)
      return
    }
    if (!r.ok && r.error === 'caido') setServidorCaido(true)
    if (!r.ok && r.error === 'sancion' && r.sancion) setSancion(r.sancion)
    setSesionVencida(ms.status === 'expired')
    setStage('cuenta')
  }, [aplicar])

  const salir = useCallback(async (): Promise<void> => {
    await window.api.cuentas.salir().catch(() => undefined)
    await window.api.auth.microsoftLogout().catch(() => undefined)
    setCuenta(null)
    setPremium(undefined)
    setSancion(null)
    setRecorrido(false)
    setNav('play')
    setStage('cuenta')
  }, [])

  /** `launch.start` no dio el vale: sanción, pasos o sesión vencida. */
  const alBloqueo = useCallback(
    (r: RespuestaCuenta): void => {
      if (r.error === 'sancion' && r.sancion) {
        setSancion(r.sancion)
        return
      }
      if (r.error === 'sesion') {
        void salir()
        return
      }
      if (r.error === 'pasos') void window.api.cuentas.estado().then((e) => aplicar(e, premium))
    },
    [aplicar, premium, salir]
  )

  const tipo: 'premium' | 'offline' = cuenta?.tipo === 'PREMIUM' ? 'premium' : 'offline'

  return (
    <>
      <AmbientMusic />
      <PanoramaBg dim={stage === 'app' ? 0.86 : 0.66} />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          height: '100vh',
          display: 'grid',
          gridTemplateRows: 'auto 1fr'
        }}
      >
        <TitleBar />

        <div style={{ overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            {stage === 'splash' && <Splash key="splash" onDone={() => void arrancar()} />}

            {stage === 'cuenta' && (
              <Cuenta
                key="cuenta"
                sesionVencida={sesionVencida}
                servidorCaido={servidorCaido}
                onReintentar={() => void arrancar()}
                onListo={(r, sesionMs) => aplicar(r, sesionMs)}
              />
            )}

            {stage === 'pasos' && cuenta && (
              <Pasos key="pasos" cuenta={cuenta} onCuenta={(r) => aplicar(r, premium)} onSalir={() => void salir()} />
            )}

            {stage === 'app' && cuenta && (
              // A motion element, not a plain div: AnimatePresence can only hold
              // "wait" ordering for children it can track. With a plain div the
              // outgoing screen and this shell can be mounted at the same moment,
              // which shows up as the sidebar appearing twice mid-transition.
              <motion.div
                key="app"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.25 } }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', height: '100%' }}
              >
                <SideNav
                  active={nav}
                  onSelect={setNav}
                  username={cuenta.nombre}
                  accountType={tipo}
                  onLogout={() => void salir()}
                />
                <div style={{ overflow: 'hidden' }}>
                  <AnimatePresence mode="wait">
                    {nav === 'play' && (
                      <Home
                        key="play"
                        username={cuenta.nombre}
                        mclcUser={premium?.mclc}
                        offlineUsername={tipo === 'offline' ? cuenta.nombre : undefined}
                        onNavigate={setNav}
                        onBloqueo={alBloqueo}
                      />
                    )}
                    {nav === 'mods' && <Modpack key="mods" />}
                    {nav === 'shaders' && <Shaders key="shaders" />}
                    {nav === 'settings' && (
                      <Settings
                        key="settings"
                        username={cuenta.nombre}
                        accountType={tipo}
                        discord={cuenta.discord}
                        onLogout={() => void salir()}
                        onVerTutorial={() => {
                          setNav('play')
                          setRecorrido(true)
                        }}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {stage === 'app' && recorrido && (
        <Recorrido
          onIr={setNav}
          onListo={() => {
            setRecorrido(false)
            void window.api.cuentas.tutorial().then((r) => {
              if (r.ok && r.cuenta) setCuenta(r.cuenta)
            })
          }}
        />
      )}

      <AnimatePresence>
        {sancion && <Sancion key="sancion" sancion={sancion} onCerrar={() => setSancion(null)} />}
      </AnimatePresence>
    </>
  )
}
