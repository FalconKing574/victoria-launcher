import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import BarraPasos from '../components/BarraPasos'
import Button from '../components/Button'
import logo from '../assets/logo.png'
import { etapasIngreso } from '../lib/formulario-cuenta'
import type { EstadoCuenta, Normas, RespuestaCuenta } from '@shared/api'

/**
 * Lo que le falta a la cuenta antes de jugar: Discord y normas.
 *
 * El recorrido y la configuración guiada no van acá: se hacen encima del
 * launcher de verdad (ver `components/Recorrido.tsx`), porque explicar un botón
 * que no se está viendo no sirve.
 *
 * Los pasos se guardan en el servidor, no en la PC: el que cambia de
 * computadora no los repite, y el que borra la carpeta del launcher tampoco se
 * los saltea.
 */

export interface PasosProps {
  cuenta: EstadoCuenta
  /** La cuenta cambió (vinculó Discord, aceptó normas). */
  onCuenta: (respuesta: RespuestaCuenta) => void
  onSalir: () => void
}

export default function Pasos({ cuenta, onCuenta, onSalir }: PasosProps): JSX.Element {
  // La misma barra que la pantalla de cuenta (`lib/formulario-cuenta.ts`): el
  // que entra con Microsoft no tiene la etapa del correo.
  const etapas = etapasIngreso(cuenta.tipo)
  const pendiente = cuenta.pasos.includes('discord')
    ? 'Discord'
    : cuenta.pasos.includes('normas')
      ? 'Normas'
      : 'Recorrido'
  const actual = etapas.indexOf(pendiente)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.3 } }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr', background: 'var(--bg-1)' }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          padding: '16px 28px',
          borderBottom: '1px solid var(--stroke)'
        }}
      >
        <img src={logo} alt="Victoria Kingdom" style={{ height: 34, imageRendering: 'pixelated' }} />
        <div style={{ flex: 1, maxWidth: 460, margin: '0 auto' }}>
          <BarraPasos etapas={etapas} actual={actual} />
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{cuenta.nombre}</span>
        <button type="button" onClick={onSalir} style={enlace}>
          Salir
        </button>
      </header>

      <div style={{ overflowY: 'auto', display: 'grid', placeItems: 'center', padding: 28 }}>
        {pendiente === 'Discord' && <PasoDiscord onCuenta={onCuenta} />}
        {pendiente === 'Normas' && <PasoNormas onCuenta={onCuenta} />}
      </div>
    </motion.div>
  )
}

function PasoDiscord({ onCuenta }: { onCuenta: (r: RespuestaCuenta) => void }): JSX.Element {
  const [esperando, setEsperando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function vincular(): Promise<void> {
    setError(null)
    setEsperando(true)
    try {
      const r = await window.api.cuentas.discord()
      if (r.ok || r.error === 'sancion') onCuenta(r)
      else setError(r.mensaje ?? 'No se pudo vincular Discord.')
    } finally {
      setEsperando(false)
    }
  }

  return (
    <div className="panel" style={{ width: 'min(520px, 100%)', padding: 28, display: 'grid', gap: 16 }}>
      <h1 style={titulo}>Vinculá tu Discord</h1>
      <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13.5, lineHeight: 1.6 }}>
        Victoria se juega con la comunidad: anuncios, eventos, tickets y soporte pasan por Discord. Al vincular
        te sumamos al servidor de Victoria con el rol de Jugador.
      </p>
      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.7 }}>
        <li>Se abre Discord en tu navegador: iniciá sesión si hace falta y tocá «Autorizar».</li>
        <li>Solo vemos tu nombre de usuario de Discord. No leemos tus mensajes.</li>
        <li>Un Discord por cuenta de Victoria.</li>
      </ul>
      <Button full loading={esperando} onClick={() => void vincular()}>
        {esperando ? 'Esperando a Discord…' : 'Vincular Discord'}
      </Button>
      {esperando && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-faint)', textAlign: 'center' }}>
          Autorizá en el navegador y volvé acá. Tenés 5 minutos.
        </p>
      )}
      {error && <p style={{ margin: 0, color: 'var(--err)', fontSize: 13 }}>{error}</p>}
    </div>
  )
}

function PasoNormas({ onCuenta }: { onCuenta: (r: RespuestaCuenta) => void }): JSX.Element {
  const [normas, setNormas] = useState<Normas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [leidas, setLeidas] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const caja = useRef<HTMLDivElement>(null)

  function cargar(): void {
    setCargando(true)
    setError(null)
    window.api.modpack
      .manifest()
      .then((m) => {
        if (m.normas) setNormas(m.normas)
        else setError('No se pudieron cargar las normas. Probá de nuevo en un rato.')
      })
      .catch(() => setError('No se pudieron cargar las normas. Revisá tu conexión.'))
      .finally(() => setCargando(false))
  }

  useEffect(cargar, [])

  // Si el texto entra entero sin scroll, ya está leído.
  useEffect(() => {
    const el = caja.current
    if (el && el.scrollHeight <= el.clientHeight + 4) setLeidas(true)
  }, [normas])

  async function aceptar(): Promise<void> {
    if (!normas) return
    setEnviando(true)
    setError(null)
    try {
      const r = await window.api.cuentas.normas(normas.version)
      if (r.ok) onCuenta(r)
      else if (r.error === 'normas_viejas') {
        setLeidas(false)
        cargar()
        setError(r.mensaje ?? 'Las normas cambiaron. Volvé a leerlas.')
      } else setError(r.mensaje ?? 'No se pudo guardar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="panel" style={{ width: 'min(680px, 100%)', padding: 28, display: 'grid', gap: 14 }}>
      <h1 style={titulo}>{normas?.titulo ?? 'Normas de Victoria'}</h1>
      <div
        ref={caja}
        onScroll={(e) => {
          const el = e.currentTarget
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setLeidas(true)
        }}
        style={{
          maxHeight: '48vh',
          overflowY: 'auto',
          background: 'var(--surface-2)',
          borderRadius: 'var(--r-md)',
          padding: '14px 18px',
          display: 'grid',
          gap: 14
        }}
      >
        {cargando && <p style={{ margin: 0, color: 'var(--text-dim)' }}>Cargando…</p>}
        {normas?.secciones.map((s) => (
          <section key={s.titulo}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14.5, color: 'var(--gold-bright)' }}>{s.titulo}</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: 'var(--text-dim)', whiteSpace: 'pre-wrap' }}>
              {s.texto}
            </p>
          </section>
        ))}
      </div>
      {!leidas && normas && (
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-faint)' }}>Bajá hasta el final para aceptar.</p>
      )}
      <Button full loading={enviando} disabled={!normas || !leidas} onClick={() => void aceptar()}>
        Leí las normas y las acepto
      </Button>
      {error && (
        <p style={{ margin: 0, color: 'var(--err)', fontSize: 13 }}>
          {error}{' '}
          {!normas && (
            <button type="button" onClick={cargar} style={enlace}>
              Reintentar
            </button>
          )}
        </p>
      )}
    </div>
  )
}

const enlace: React.CSSProperties = {
  background: 'none',
  border: 0,
  padding: 0,
  color: 'var(--text-dim)',
  fontSize: 12.5,
  textDecoration: 'underline',
  cursor: 'pointer'
}

const titulo: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: 'uppercase'
}
