import { useState } from 'react'
import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import Button from '../components/Button'
import Field from '../components/Field'
import logo from '../assets/logo.png'
import { screenVariants } from '../theme/motion'
import type { PremiumSession } from '@shared/api'

export interface LoginProps {
  onPremium: (session: PremiumSession) => void
  onOffline: (username: string) => void
}

export default function Login({ onPremium, onOffline }: LoginProps): JSX.Element {
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState<'ms' | 'offline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const nickValid = /^[A-Za-z0-9_]{3,16}$/.test(username.trim())

  async function handleMicrosoft(): Promise<void> {
    setError(null)
    setBusy('ms')
    try {
      onPremium(await window.api.auth.microsoftLogin())
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(null)
    }
  }

  function handleOffline(): void {
    setError(null)
    setBusy('offline')
    onOffline(username.trim())
  }

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ display: 'grid', placeItems: 'center', height: '100%' }}
    >
      <GlassCard style={{ width: 420, display: 'grid', gap: 20 }}>
        <img
          src={logo}
          alt="Victoria Kingdom"
          style={{ width: 210, justifySelf: 'center', imageRendering: 'pixelated' }}
        />

        <Button variant="microsoft" full loading={busy === 'ms'} onClick={handleMicrosoft}>
          Iniciar sesión con Microsoft
        </Button>

        <Divider label="o juega sin cuenta premium" />

        <Field
          label="Nombre de usuario"
          value={username}
          onChange={setUsername}
          placeholder="Tu nick en el servidor"
        />

        {username.length > 0 && !nickValid && (
          <p style={{ color: 'var(--err)', fontSize: 12, margin: 0 }}>
            3-16 caracteres: letras, números o guion bajo.
          </p>
        )}

        <Button full loading={busy === 'offline'} disabled={!nickValid} onClick={handleOffline}>
          Entrar
        </Button>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ color: 'var(--err)', fontSize: 13, margin: 0, textAlign: 'center' }}
          >
            {error}
          </motion.p>
        )}
      </GlassCard>
    </motion.div>
  )
}

function Divider({ label }: { label: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
    </div>
  )
}
