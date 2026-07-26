import { useState } from 'react'
import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import Button from '../components/Button'
import Field from '../components/Field'
import logo from '../assets/logo.png'
import { screenVariants } from '../theme/motion'
import type { LauncherProfile, PremiumSession } from '@shared/api'

export interface LoginProps {
  onPremium: (session: PremiumSession) => void
  onCustom: (profile: LauncherProfile) => void
  onGoRegister: () => void
}

export default function Login({ onPremium, onCustom, onGoRegister }: LoginProps): JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'ms' | 'custom' | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  async function handleCustom(): Promise<void> {
    setError(null)
    setBusy('custom')
    try {
      onCustom(await window.api.account.login(email, password))
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(null)
    }
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

        <Divider label="o con tu cuenta del launcher" />

        <Field label="Correo" type="email" value={email} onChange={setEmail} />
        <Field label="Contraseña" type="password" value={password} onChange={setPassword} />

        <Button
          full
          loading={busy === 'custom'}
          disabled={!email || !password}
          onClick={handleCustom}
        >
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

        <button
          onClick={onGoRegister}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            fontSize: 13,
            textDecoration: 'underline'
          }}
        >
          ¿No tienes cuenta? Crear una
        </button>
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
