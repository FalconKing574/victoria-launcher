import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { screenVariants } from '../theme/motion'
import type { ModEntry } from '@shared/api'

export default function Mods(): JSX.Element {
  const [mods, setMods] = useState<ModEntry[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Without the catch, a failed scan silently shows an empty list as if the
    // instance simply had no mods.
    window.api.mods
      .list()
      .then(setMods)
      .catch(() => setError('No se pudieron leer los mods de la instancia.'))
  }, [])

  const filtered = useMemo(
    () => mods.filter((mod) => mod.name.toLowerCase().includes(query.toLowerCase())),
    [mods, query]
  )

  const enabledCount = mods.filter((mod) => mod.enabled).length

  async function handleToggle(mod: ModEntry): Promise<void> {
    setBusy(mod.filename)
    try {
      setMods(await window.api.mods.toggle(mod.filename, !mod.enabled))
      setError(null)
    } catch {
      setError(`No se pudo cambiar el estado de ${mod.name}.`)
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
      style={{ padding: 34, height: '100%', display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 18 }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800 }}>Mods</h1>
        <p style={{ margin: '5px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>
          {enabledCount} activos de {mods.length} instalados
        </p>
        {error && (
          <p style={{ margin: '8px 0 0', color: 'var(--err)', fontSize: 13 }}>{error}</p>
        )}
      </div>

      <input
        value={query}
        placeholder="Buscar mod..."
        onChange={(event) => setQuery(event.target.value)}
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--stroke)',
          borderRadius: 11,
          padding: '11px 14px',
          color: 'var(--text)',
          fontSize: 14,
          outline: 'none'
        }}
      />

      <div style={{ overflowY: 'auto', display: 'grid', gap: 7, alignContent: 'start' }}>
        {filtered.map((mod) => (
          <motion.div
            key={mod.filename}
            layout
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 15px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid var(--stroke)'
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 14 }}>{mod.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {mod.filename} · {(mod.sizeBytes / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>

            <button
              onClick={() => handleToggle(mod)}
              disabled={busy === mod.filename}
              style={{
                width: 46,
                height: 25,
                borderRadius: 99,
                border: 'none',
                padding: 3,
                background: mod.enabled ? 'var(--gold)' : 'rgba(255,255,255,0.14)',
                display: 'flex',
                justifyContent: mod.enabled ? 'flex-end' : 'flex-start',
                transition: 'background 0.22s',
                flexShrink: 0
              }}
            >
              <motion.span
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff' }}
              />
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
