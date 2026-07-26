import { useState } from 'react'
import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import Button from '../components/Button'
import Field from '../components/Field'
import DiscordLinkStep from '../components/DiscordLinkStep'
import { screenVariants } from '../theme/motion'
import type { LauncherProfile } from '@shared/api'

export interface RegisterProps {
  onComplete: (profile: LauncherProfile) => void
  onBack: () => void
}

export default function Register({ onComplete, onBack }: RegisterProps): JSX.Element {
  const [step, setStep] = useState<'form' | 'discord'>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [nick, setNick] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nickValid = /^[A-Za-z0-9_]{3,16}$/.test(nick)
  const canSubmit = email && password.length >= 6 && password === confirm && nickValid

  async function handleRegister(): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      await window.api.account.register(email, password, nick)
      setStep('discord')
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
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
      <GlassCard style={{ width: 420, display: 'grid', gap: 18 }}>
        {step === 'form' ? (
          <>
            <h2 style={{ margin: 0, textAlign: 'center' }}>Crear cuenta</h2>

            <Field label="Nick de Minecraft" value={nick} onChange={setNick} autoFocus />
            {nick && !nickValid && (
              <p style={{ color: 'var(--err)', fontSize: 12, margin: 0 }}>
                3-16 caracteres: letras, números o guion bajo.
              </p>
            )}

            <Field label="Correo" type="email" value={email} onChange={setEmail} />
            <Field label="Contraseña" type="password" value={password} onChange={setPassword} />
            <Field label="Repetir contraseña" type="password" value={confirm} onChange={setConfirm} />

            {confirm && password !== confirm && (
              <p style={{ color: 'var(--err)', fontSize: 12, margin: 0 }}>
                Las contraseñas no coinciden.
              </p>
            )}

            <Button full loading={busy} disabled={!canSubmit} onClick={handleRegister}>
              Continuar
            </Button>

            {error && (
              <p style={{ color: 'var(--err)', fontSize: 13, margin: 0, textAlign: 'center' }}>
                {error}
              </p>
            )}

            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                fontSize: 13,
                textDecoration: 'underline'
              }}
            >
              Volver
            </button>
          </>
        ) : (
          <DiscordLinkStep onLinked={onComplete} />
        )}
      </GlassCard>
    </motion.div>
  )
}
