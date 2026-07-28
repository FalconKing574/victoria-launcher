import { useState } from 'react'
import { motion } from 'framer-motion'
import Button from '../components/Button'
import Icon from '../components/Icon'
import logo from '../assets/logo.png'
import art from '../assets/victoria.png'
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      // 420px so the 300px logo keeps ~26px of air on each side once the
      // column's 34px padding is taken off.
      style={{ display: 'grid', gridTemplateColumns: '420px 1fr', height: '100%' }}
    >
      {/* Form column — solid, so it reads as a panel rather than an overlay. */}
      <div
        style={{
          background: 'var(--bg-1)',
          borderRight: '1px solid var(--stroke)',
          padding: '38px 34px',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          gap: 24,
          overflowY: 'auto'
        }}
      >
        <img
          src={logo}
          alt="Victoria Kingdom"
          style={{
            width: '100%',
            maxWidth: 300,
            justifySelf: 'center',
            imageRendering: 'pixelated',
            marginTop: 6
          }}
        />

        <div style={{ display: 'grid', gap: 22, alignContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 700 }}>Bienvenido</h1>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>
              Entra con tu cuenta de Minecraft, o juega escribiendo un nombre.
            </p>
          </div>

          <Button variant="microsoft" full loading={busy === 'ms'} onClick={handleMicrosoft}>
            Iniciar sesión con Microsoft
          </Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
            <span className="eyebrow">sin cuenta premium</span>
            <span style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!nickValid) return
              setError(null)
              setBusy('offline')
              onOffline(username.trim())
            }}
            style={{ display: 'grid', gap: 12 }}
          >
            <label style={{ display: 'grid', gap: 7 }}>
              <span className="eyebrow">Nombre de usuario</span>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 13,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-faint)',
                    pointerEvents: 'none'
                  }}
                >
                  <Icon name="user" size={15} />
                </span>
                <input
                  value={username}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="Tu nick en el servidor"
                  onChange={(event) => setUsername(event.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--stroke)',
                    borderRadius: 10,
                    padding: '11px 13px 11px 38px',
                    color: 'var(--text)',
                    fontSize: 14,
                    outline: 'none',
                    transition: 'border-color 0.16s'
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--stroke)')}
                />
              </div>
            </label>

            {username.length > 0 && !nickValid && (
              <p style={{ color: 'var(--err)', fontSize: 12, margin: 0 }}>
                3-16 caracteres: letras, números o guion bajo.
              </p>
            )}

            <Button type="submit" full loading={busy === 'offline'} disabled={!nickValid}>
              Entrar
            </Button>
          </form>

          {error && (
            <p style={{ color: 'var(--err)', fontSize: 13, margin: 0 }}>{error}</p>
          )}
        </div>

        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6 }}>
          Minecraft 1.20.1 · Forge 47.4.0
        </p>
      </div>

      {/* Art column — the server's own key art, not a stock gradient. */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          src={art}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 28%'
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, rgba(13,13,20,0.85), rgba(13,13,20,0.15) 45%, rgba(13,13,20,0.55))'
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 34,
            bottom: 30,
            right: 34,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 20
          }}
        >
          <div>
            <p className="eyebrow" style={{ margin: '0 0 6px' }}>
              Servidor oficial
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: -0.4,
                textShadow: '0 2px 20px rgba(0,0,0,0.6)'
              }}
            >
              Victoria Kingdom
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
