import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Button from '../components/Button'
import Icon, { type IconName } from '../components/Icon'
import Panel from '../components/Panel'
import ProgressBar from '../components/ProgressBar'
import RemoteImage from '../components/RemoteImage'
import { Switch } from '../components/Toggle'
import { screenVariants } from '../theme/motion'
import type { Manifest, OptionalMod, SyncReport, SyncState } from '@shared/api'

const CATEGORY_LABEL: Record<OptionalMod['category'], string> = {
  rendimiento: 'RENDIMIENTO',
  'calidad-de-vida': 'CALIDAD DE VIDA',
  visual: 'VISUAL'
}

export default function Modpack(): JSX.Element {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [state, setState] = useState<SyncState | null>(null)
  // Distinct from an error: with no MANIFEST_URL configured there is simply
  // nothing published yet, which is a normal state and not a failure.
  const [unavailable, setUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)

  const [syncing, setSyncing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const [report, setReport] = useState<SyncReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    let alive = true

    // El estado local se lee aparte: si el manifiesto remoto no existe todavía,
    // la versión instalada sigue siendo información útil que mostrar.
    window.api.modpack
      .state()
      .then((nextState) => {
        if (alive) setState(nextState)
      })
      .catch(() => undefined)

    window.api.modpack
      .manifest()
      .then((nextManifest) => {
        if (alive) setManifest(nextManifest)
      })
      .catch(() => {
        if (alive) setUnavailable(true)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    const offStatus = window.api.modpack.onStatus((s) => setStatusMessage(s.message))
    const offProgress = window.api.modpack.onProgress((p) => setPercent(p.percent))
    return () => {
      alive = false
      offStatus()
      offProgress()
    }
  }, [])

  async function handleSync(): Promise<void> {
    setSyncing(true)
    setError(null)
    setReport(null)
    setPercent(null)
    setStatusMessage('Comprobando el manifiesto...')
    try {
      const result = await window.api.modpack.sync()
      setReport(result)
      setUnavailable(false)
      // The pack version and the managed list both move during a sync.
      const [nextManifest, nextState] = await Promise.all([
        window.api.modpack.manifest(),
        window.api.modpack.state()
      ])
      setManifest(nextManifest)
      setState(nextState)
    } catch {
      setError('No se pudo comprobar la actualización. Revisa tu conexión e inténtalo otra vez.')
    } finally {
      setSyncing(false)
      setStatusMessage(null)
      setPercent(null)
    }
  }

  async function handleOptional(mod: OptionalMod, enabled: boolean): Promise<void> {
    setPending(mod.id)
    try {
      setState(await window.api.modpack.setOptional(mod.id, enabled))
      setError(null)
    } catch {
      setError(`No se pudo cambiar ${mod.name}.`)
    } finally {
      setPending(null)
    }
  }

  const optional = manifest?.optional ?? []
  const enabledIds = state?.enabledOptional ?? []
  const enabledCount = optional.filter((mod) => enabledIds.includes(mod.id)).length

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        padding: 26,
        height: '100%',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gap: 16
      }}
    >
      {/* No pack version, no update button: installing and updating the modpack
          is the play button's job now, so this screen is only the choices. */}
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Mods</h1>
        <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--text-dim)' }}>
          Extras opcionales. El resto del modpack se instala solo al jugar.
        </p>
      </div>

      <div style={{ overflowY: 'auto', display: 'grid', gap: 12, alignContent: 'start' }}>
        {loading && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)' }}>Cargando el modpack...</p>
        )}

        {!loading && unavailable && <Unpublished />}

        {!loading && !unavailable && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <p className="eyebrow" style={{ margin: 0 }}>
                Mods opcionales
              </p>
              <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                {enabledCount} de {optional.length} activados · se instalan al buscar
                actualizaciones
              </span>
            </div>

            {optional.length === 0 && (
              <div className="row" style={{ padding: '13px 15px', fontSize: 13, color: 'var(--text-dim)' }}>
                Este modpack no trae mods opcionales todavía.
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
                gap: 12
              }}
            >
              {optional.map((mod, index) => {
                const enabled = enabledIds.includes(mod.id)
                return (
                  <Panel
                    key={mod.id}
                    delay={0.03 * index}
                    style={{ padding: 0, overflow: 'hidden', display: 'grid', alignContent: 'start' }}
                  >
                    <div style={{ position: 'relative' }}>
                      <RemoteImage
                        src={mod.image}
                        alt=""
                        label={mod.name}
                        style={{ height: 104 }}
                        position="center 40%"
                      />
                      <span
                        style={{
                          position: 'absolute',
                          top: 9,
                          left: 9,
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: 0.7,
                          padding: '4px 8px',
                          borderRadius: 5,
                          background: 'rgba(9,9,14,0.82)',
                          color: 'var(--gold-bright)'
                        }}
                      >
                        {CATEGORY_LABEL[mod.category]}
                      </span>
                    </div>

                    <div style={{ padding: '12px 14px 13px', display: 'grid', gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{mod.name}</div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: 'var(--text-dim)',
                          lineHeight: 1.55,
                          minHeight: 37
                        }}
                      >
                        {mod.summary}
                      </p>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          paddingTop: 3,
                          borderTop: '1px solid var(--stroke)'
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--text-faint)',
                            paddingTop: 6,
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          {(mod.sizeBytes / 1024 / 1024).toFixed(1)} MB · {mod.filename}
                        </span>
                        <span style={{ paddingTop: 6 }}>
                          <Switch
                            checked={enabled}
                            disabled={pending === mod.id}
                            onChange={(value) => handleOptional(mod, value)}
                            ariaLabel={mod.name}
                          />
                        </span>
                      </div>
                    </div>
                  </Panel>
                )
              })}
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}

function SyncSummary({ report }: { report: SyncReport }): JSX.Element {
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 }}>
        <SummaryTile
          icon="check"
          value={report.packVersion}
          label={report.upToDate ? 'Ya estaba al día' : 'Versión instalada ahora'}
        />
        <SummaryTile icon="download" value={String(report.downloaded)} label="Mods descargados" />
        <SummaryTile icon="trash" value={String(report.removed)} label="Mods retirados" />
      </div>

      {report.keptOwn.length > 0 && (
        <div
          className="row"
          style={{ display: 'flex', gap: 11, padding: '11px 13px', alignItems: 'flex-start' }}
        >
          <span style={{ color: 'var(--gold)', paddingTop: 1 }}>
            <Icon name="shield" size={15} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>
              {report.keptOwn.length} {report.keptOwn.length === 1 ? 'mod tuyo' : 'mods tuyos'} sin
              tocar
            </div>
            <p
              style={{
                margin: '3px 0 0',
                fontSize: 11.5,
                color: 'var(--text-faint)',
                lineHeight: 1.55
              }}
            >
              No los instaló el launcher, los añadiste tú, así que se quedan donde están:{' '}
              {report.keptOwn.join(', ')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryTile({
  icon,
  value,
  label
}: {
  icon: IconName
  value: string
  label: string
}): JSX.Element {
  return (
    <div className="row" style={{ padding: '10px 12px', display: 'grid', gap: 2 }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: 16,
          fontWeight: 800,
          color: 'var(--gold-bright)'
        }}
      >
        <Icon name={icon} size={14} />
        {value}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{label}</span>
    </div>
  )
}

function Unpublished(): JSX.Element {
  return (
    <Panel style={{ padding: 20, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'var(--surface-3)',
          color: 'var(--text-dim)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0
        }}
      >
        <Icon name="info" size={17} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700 }}>Todavía no hay un modpack publicado</div>
        <p style={{ margin: '5px 0 0', fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Cuando el staff publique la primera versión, aquí verás la lista de mods opcionales y
          podrás elegir cuáles instalar. Mientras tanto puedes jugar con el modpack que ya tienes en
          la instancia.
        </p>
      </div>
    </Panel>
  )
}
