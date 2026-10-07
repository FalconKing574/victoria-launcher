import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import arteFijo from '../assets/victoria.png'

/**
 * El arte de la pantalla de cuenta: capturas del servidor que van rotando, como
 * los lugares del mapa que muestra el launcher de Majestic.
 *
 * Toma solo lo que haya en `assets/capturas/`, así que cambiarlas no toca
 * código: se ponen ahí con `node scripts/importar-capturas.mjs`, que además las
 * achica. Sin ninguna, queda el arte de siempre.
 */
const CAPTURAS = Object.values(
  import.meta.glob('../assets/capturas/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' })
) as string[]

const CADA_MS = 7000

export default function ArteCapturas(): JSX.Element {
  const imagenes = CAPTURAS.length > 0 ? CAPTURAS : [arteFijo]
  const [actual, setActual] = useState(0)

  useEffect(() => {
    if (imagenes.length < 2) return
    const reloj = setInterval(() => setActual((i) => (i + 1) % imagenes.length), CADA_MS)
    return () => clearInterval(reloj)
  }, [imagenes.length])

  return (
    <div style={{ position: 'relative', overflow: 'hidden', background: 'var(--bg-0)' }}>
      <AnimatePresence initial={false}>
        <motion.img
          key={imagenes[actual]}
          src={imagenes[actual]}
          alt=""
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: 1, scale: CAPTURAS.length > 0 ? 1.06 : 1 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.2 },
            scale: { duration: CADA_MS / 1000 + 1.2, ease: 'linear' }
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: CAPTURAS.length > 0 ? 'center' : 'center 28%'
          }}
        />
      </AnimatePresence>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(14,14,15,0.7), rgba(14,14,15,0.05) 40%, rgba(14,14,15,0.05) 70%, rgba(14,14,15,0.55)), linear-gradient(0deg, rgba(14,14,15,0.75), rgba(14,14,15,0) 35%)'
        }}
      />

      <div
        style={{
          position: 'absolute',
          right: 28,
          bottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          textShadow: '0 2px 16px rgba(0,0,0,0.7)'
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Victoria Kingdom</span>
        <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.35)' }} />
        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Servidor de rol</span>
      </div>

      {imagenes.length > 1 && (
        <div style={{ position: 'absolute', left: 28, bottom: 30, display: 'flex', gap: 6 }}>
          {imagenes.map((imagen, i) => (
            <span
              key={imagen}
              style={{
                width: i === actual ? 18 : 6,
                height: 6,
                borderRadius: 3,
                background: i === actual ? 'var(--gold)' : 'rgba(255,255,255,0.35)',
                transition: 'width 0.3s, background 0.3s'
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
