import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Panel from '../components/Panel'
import { screenVariants } from '../theme/motion'
import type { Settings as SettingsType } from '@shared/api'

export default function Settings(): JSX.Element {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Without the catch, a failed read leaves this screen on "Cargando..." forever
    // with nothing logged and no way for the user to know why.
    window.api.settings
      .get()
      .then(setSettings)
      .catch(() => setError('No se pudieron cargar los ajustes.'))
  }, [])

  async function patch(update: Partial<SettingsType>): Promise<void> {
    try {
      setSettings(await window.api.settings.save(update))
      setError(null)
      // Lets AmbientMusic pick up a music toggle without a restart.
      window.dispatchEvent(new CustomEvent('settings-changed'))
    } catch {
      setError('No se pudieron guardar los ajustes.')
    }
  }

  if (error && !settings) {
    return <div style={{ padding: 34, color: 'var(--err)' }}>{error}</div>
  }
  if (!settings) return <div style={{ padding: 34 }}>Cargando...</div>

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ padding: 34, height: '100%', overflowY: 'auto' }}
    >
      <h1 style={{ margin: '0 0 22px', fontSize: 30, fontWeight: 800 }}>Ajustes</h1>

      {error && (
        <p style={{ margin: '0 0 16px', color: 'var(--err)', fontSize: 13 }}>{error}</p>
      )}

      <Panel style={{ maxWidth: 520, display: 'grid', gap: 22 }}>
        <div style={{ display: 'grid', gap: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span>Memoria máxima</span>
            <span style={{ color: 'var(--gold)' }}>
              {(settings.maxMemoryMb / 1024).toFixed(1)} GB
            </span>
          </div>
          <input
            type="range"
            min={1024}
            max={16384}
            step={512}
            value={settings.maxMemoryMb}
            onChange={(event) => patch({ maxMemoryMb: Number(event.target.value) })}
            style={{ accentColor: 'var(--gold)' }}
          />
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)' }}>
            Con este modpack, 8 GB es un buen punto de partida.
          </p>
        </div>

        <Toggle
          label="Música del launcher"
          checked={settings.musicEnabled}
          onChange={(value) => patch({ musicEnabled: value })}
        />

        <Toggle
          label="Cerrar el launcher al iniciar el juego"
          checked={settings.closeOnLaunch}
          onChange={(value) => patch({ closeOnLaunch: value })}
        />

        <div style={{ display: 'grid', gap: 7 }}>
          <span style={{ fontSize: 14 }}>Ruta de Java</span>
          <input
            value={settings.javaPath ?? ''}
            placeholder="Automático (detectado del sistema)"
            onChange={(event) => patch({ javaPath: event.target.value || null })}
            spellCheck={false}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--stroke)',
              borderRadius: 10,
              padding: '11px 14px',
              color: 'var(--text)',
              fontSize: 13,
              outline: 'none',
              transition: 'border-color 0.16s'
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gold)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--stroke)')}
          />
        </div>
      </Panel>
    </motion.div>
  )
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 46,
          height: 25,
          borderRadius: 99,
          border: 'none',
          padding: 3,
          background: checked ? 'var(--gold)' : 'rgba(255,255,255,0.14)',
          display: 'flex',
          justifyContent: checked ? 'flex-end' : 'flex-start',
          transition: 'background 0.22s'
        }}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff' }}
        />
      </button>
    </div>
  )
}
