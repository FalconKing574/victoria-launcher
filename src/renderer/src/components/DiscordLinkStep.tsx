import { useState } from 'react'
import { motion } from 'framer-motion'
import Button from './Button'
import type { LauncherProfile } from '@shared/api'

export interface DiscordLinkStepProps {
  onLinked: (profile: LauncherProfile) => void
}

export default function DiscordLinkStep({ onLinked }: DiscordLinkStepProps): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLink(): Promise<void> {
    setError(null)
    setBusy(true)
    try {
      onLinked(await window.api.account.linkDiscord())
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 18, textAlign: 'center' }}>
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        style={{ fontSize: 46 }}
      >
        🔗
      </motion.div>

      <div>
        <h2 style={{ margin: '0 0 8px' }}>Vincula tu Discord</h2>
        <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6 }}>
          Es obligatorio para usar el launcher. Así el staff puede darte acceso al servidor y
          contactarte.
        </p>
      </div>

      <Button variant="discord" full loading={busy} onClick={handleLink}>
        Vincular con Discord
      </Button>

      {error && <p style={{ color: 'var(--err)', fontSize: 13, margin: 0 }}>{error}</p>}
    </div>
  )
}
