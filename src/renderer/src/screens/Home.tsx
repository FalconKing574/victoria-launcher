import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Button from '../components/Button'
import ProgressBar from '../components/ProgressBar'
import GlassCard from '../components/GlassCard'
import { fadeUp, screenVariants, staggerChildren } from '../theme/motion'
import newsBg from '../assets/news-background.png'
import type { LaunchProgress, LaunchStatus } from '@shared/api'
import type { IUser } from 'minecraft-launcher-core'

export interface HomeProps {
  username: string
  mclcUser?: IUser
  offlineUsername?: string
}

export default function Home({ username, mclcUser, offlineUsername }: HomeProps): JSX.Element {
  const [progress, setProgress] = useState<LaunchProgress | null>(null)
  const [status, setStatus] = useState<LaunchStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    const offProgress = window.api.launch.onProgress(setProgress)
    const offStatus = window.api.launch.onStatus(setStatus)
    const offError = window.api.launch.onError((payload) => {
      setError(payload.message)
      setLaunching(false)
    })
    const offClosed = window.api.launch.onClosed(() => {
      setLaunching(false)
      setStatus(null)
      setProgress(null)
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
      style={{ padding: 34, height: '100%', display: 'grid', gridTemplateRows: '1fr auto', gap: 24 }}
    >
      <motion.div variants={staggerChildren} initial="initial" animate="animate">
        <motion.p variants={fadeUp} style={{ color: 'var(--text-dim)', margin: 0, fontSize: 15 }}>
          Bienvenido de vuelta,
        </motion.p>
        <motion.h1
          variants={fadeUp}
          style={{ margin: '4px 0 26px', fontSize: 40, fontWeight: 800, letterSpacing: -0.5 }}
        >
          {username}
        </motion.h1>

        <motion.div variants={fadeUp}>
          <GlassCard
            style={{
              maxWidth: 460,
              backgroundImage: `linear-gradient(rgba(13,13,20,0.86), rgba(13,13,20,0.94)), url(${newsBg})`,
              backgroundSize: 'cover'
            }}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Novedades</h3>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.65 }}>
              Servidor Victoria Kingdom — Minecraft 1.20.1 con Forge. Revisa el Discord para
              enterarte de eventos y actualizaciones.
            </p>
          </GlassCard>
        </motion.div>
      </motion.div>

      <div style={{ display: 'grid', gap: 14, maxWidth: 460 }}>
        {launching && progress && (
          <ProgressBar percent={progress.percent} label={status?.message ?? 'Preparando...'} />
        )}
        {launching && !progress && status && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>{status.message}</p>
        )}
        {error && <p style={{ margin: 0, fontSize: 13, color: 'var(--err)' }}>{error}</p>}

        <Button full loading={launching} onClick={handlePlay}>
          {launching ? 'INICIANDO...' : 'JUGAR'}
        </Button>
      </div>
    </motion.div>
  )
}
