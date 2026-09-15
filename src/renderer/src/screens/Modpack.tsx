import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Icon from '../components/Icon'
import Panel from '../components/Panel'
import RemoteImage from '../components/RemoteImage'
import { Switch } from '../components/Toggle'
import { screenVariants } from '../theme/motion'
import type { Manifest, OptionalMod, SyncState } from '@shared/api'

import iconDistantHorizons from '../assets/mods/distant-horizons.png'
import iconForgematica from '../assets/mods/forgematica.png'

const CATEGORY_LABEL: Record<OptionalMod['category'], string> = {
  rendimiento: 'RENDIMIENTO',
  'calidad-de-vida': 'CALIDAD DE VIDA',
  visual: 'VISUAL'
}

/**
 * Icons shipped with the launcher, by mod id.
 *
 * The manifest carries an `image` URL per optional mod, and all three of them
 * pointed at media.forgecdn.net paths that answer 404 (NoSuchKey). So every
 * card fell back to a giant letter on a gold square — which is exactly what
 * "las imágenes no cargan" looked like.
 *
 * The optional list is short and hand-curated in scripts/build-manifest.mjs, so
 * shipping its art costs 70 KB and can never break: no CDN, no hotlink, and it
 * still works with the PC offline. The manifest's URL is kept as the fallback
 * so a new optional mod can still bring its own image without a launcher
 * release.
 */
const LOCAL_ICONS: Record<string, string> = {
  'distant-horizons': iconDistantHorizons,
  forgematica: iconForgematica
}

export default function Modpack(): JSX.Element {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [state, setState] = useState<SyncState | null>(null)
  // Distinct from an error: with no MANIFEST_URL configured there is simply
  // nothing published yet, which is a normal state and not a failure.
  const [unavailable, setUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)
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

    // A sync started from the Play screen changes which optional mods are
    // actually on disk, so refresh the switches when one finishes rather than
    // leaving this screen showing what was true when it mounted.
    const offDone = window.api.modpack.onDone(() => {
      window.api.modpack
        .state()
        .then((nextState) => {
          if (alive) setState(nextState)
        })
        .catch(() => undefined)
    })
    return () => {
      alive = false
      offDone()
    }
  }, [])

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

        {/* Este aviso no existía: si fallaba guardar la elección, el interruptor
            volvía a su sitio y no se decía nada, así que parecía que el clic no
            había llegado. */}
        {error && (
          <div
            className="row"
            style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--err)', lineHeight: 1.55 }}
          >
            {error}
          </div>
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
                        src={LOCAL_ICONS[mod.id] ?? mod.image}
                        alt=""
                        label={mod.name}
                        style={{ height: 104 }}
                        fit="contain"
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

                    {/* minWidth 0 en la rejilla: sin esto, una celda de grid no
                        baja de su ancho de contenido, y la fila de abajo no
                        podía encoger por mucho ellipsis que llevara dentro. */}
                    <div
                      style={{ padding: '12px 14px 13px', display: 'grid', gap: 8, minWidth: 0 }}
                    >
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
                          flexWrap: 'nowrap',
                          gap: 10,
                          minWidth: 0,
                          paddingTop: 3,
                          borderTop: '1px solid var(--stroke)'
                        }}
                      >
                        {/* El tamaño no se encoge y el nombre sí. Iban juntos en
                            un solo span sin recortar, y los nombres reales
                            ("DistantHorizons-3.2.0-b-1.20.1-fabric-forge.jar")
                            piden 326 px donde hay 184: la línea se partía en
                            tres y empujaba el interruptor fuera de sitio. */}
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 6,
                            flex: '1 1 auto',
                            minWidth: 0,
                            overflow: 'hidden',
                            paddingTop: 6,
                            fontSize: 11,
                            color: 'var(--text-faint)'
                          }}
                          title={mod.filename}
                        >
                          <span style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {(mod.sizeBytes / 1024 / 1024).toFixed(1)} MB
                          </span>
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              minWidth: 0
                            }}
                          >
                            · {mod.filename}
                          </span>
                        </span>
                        <span style={{ paddingTop: 6, flexShrink: 0 }}>
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
