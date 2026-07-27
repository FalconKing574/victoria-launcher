import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Button from '../components/Button'
import Panel from '../components/Panel'
import ProgressBar from '../components/ProgressBar'
import { screenVariants } from '../theme/motion'
import newsBg from '../assets/news-background.png'
import type { LaunchProgress, LaunchStatus } from '@shared/api'
import type { IUser } from 'minecraft-launcher-core'

export interface HomeProps {
  username: string
  mclcUser?: IUser
  offlineUsername?: string
}

const NEWS = [
  {
    tag: 'Servidor',
    title: 'Victoria Kingdom — temporada abierta',
    body: 'Minecraft 1.20.1 con Forge 47.4.0 y el modpack completo ya instalado.'
  },
  {
    tag: 'Comunidad',
    title: 'Eventos y avisos en Discord',
    body: 'Las novedades, caídas y eventos se anuncian primero en el Discord del servidor.'
  }
]

export default function Home({ username, mclcUser, offlineUsername }: HomeProps): JSX.Element {
  const [progress, setProgress] = useState<LaunchProgress | null>(null)
  const [status, setStatus] = useState<LaunchStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    // The launch may already be running if the user navigated away and back:
    // this screen unmounts on tab change, which used to reset the button to
    // "JUGAR" while Forge was still downloading.
    window.api.launch
      .isRunning()
      .then(setLaunching)
      .catch(() => undefined)

    const offProgress = window.api.launch.onProgress(setProgress)
    const offStatus = window.api.launch.onStatus(setStatus)
    const offError = window.api.launch.onError((payload) => {
      setError(payload.message)
      setLaunching(false)
    })
    const offClosed = window.api.launch.onClosed((info) => {
      setLaunching(false)
      setStatus(null)
      setProgress(null)
      // A non-zero exit means the game died rather than being closed normally.
      if (info.code !== 0) {
        setError(
          `Minecraft se cerró con el código ${info.code}. Revisa la memoria y la ruta de Java en Ajustes.`
        )
      }
    })
    return () => {
      offProgress()
      offStatus()
      offError()
      offClosed()
    }
  }, [])

  async function handlePlay(): Promise<void> {
    setError(null)
    setLaunching(true)
    try {
      await window.api.launch.start({ mclcUser, offlineUsername })
    } catch (caught) {
      setError((caught as Error).message)
      setLaunching(false)
    }
  }

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        padding: 28,
        height: '100%',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.35fr) minmax(270px, 1fr)',
        gap: 20,
        alignContent: 'start',
        overflowY: 'auto'
      }}
    >
      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <div>
          <p className="eyebrow" style={{ margin: '0 0 4px' }}>
            Hola de nuevo
          </p>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: -0.6 }}>
            {username}
          </h1>
        </div>

        <Panel style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--ok)',
                boxShadow: '0 0 8px var(--ok)',
                flexShrink: 0
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Victoria Kingdom</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Minecraft 1.20.1 · Forge 47.4.0
              </div>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                padding: '5px 9px',
                borderRadius: 6,
                background: 'rgba(230,180,34,0.12)',
                color: 'var(--gold-bright)'
              }}
            >
              MODPACK
            </span>
          </div>

          {launching && progress && (
            <ProgressBar percent={progress.percent} label={status?.message ?? 'Preparando...'} />
          )}
          {launching && !progress && status && (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-dim)' }}>{status.message}</p>
          )}
          {error && (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--err)', lineHeight: 1.5 }}>
              {error}
            </p>
          )}

          <Button full loading={launching} onClick={handlePlay}>
            {launching ? 'INICIANDO...' : 'JUGAR'}
          </Button>
        </Panel>
      </div>

      <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <p className="eyebrow" style={{ margin: 0 }}>
          Novedades
        </p>

        {NEWS.map((item, index) => (
          <Panel
            key={item.title}
            delay={0.05 * (index + 1)}
            style={{ padding: 0, overflow: 'hidden' }}
          >
            <div
              style={{
                height: 74,
                backgroundImage: `linear-gradient(rgba(13,13,20,0.35), rgba(13,13,20,0.9)), url(${newsBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'flex-end',
                padding: 12
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  padding: '4px 8px',
                  borderRadius: 5,
                  background: 'rgba(230,180,34,0.16)',
                  color: 'var(--gold-bright)'
                }}
              >
                {item.tag}
              </span>
            </div>
            <div style={{ padding: '13px 15px 16px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 5 }}>{item.title}</div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                {item.body}
              </p>
            </div>
          </Panel>
        ))}
      </div>
    </motion.div>
  )
}
