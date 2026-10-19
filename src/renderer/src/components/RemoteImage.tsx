import { useState } from 'react'
import type { CSSProperties } from 'react'

export interface RemoteImageProps {
  /** May be undefined (a mod with no art) or a URL that simply fails to load. */
  src?: string
  alt?: string
  /**
   * When given, the fallback shows this text's first letter on a gold-tinted
   * square. Without it the fallback is a plain gold-tinted texture.
   */
  label?: string
  style?: CSSProperties
  /** Object-position for the loaded image, e.g. 'center 30%'. */
  position?: string
  /**
   * How the image fills its box.
   *
   * 'cover' is right for wide artwork. 'contain' is for square logos: a mod's
   * icon is 128x128, and stretching that across a 268x104 banner blew it up to
   * four times its size and cropped the top and bottom off. Shown contained it
   * stays sharp and reads as the mod's badge, which is what it is.
   */
  fit?: 'cover' | 'contain'
  /**
   * Una imagen local para cuando `src` no carga: las novedades vienen de la
   * web, y sin red se ven con las fotos que trae el launcher.
   */
  respaldo?: string
}

/**
 * Remote art with a guaranteed fallback. The launcher must never show the
 * browser's broken-image glyph: these URLs are hotlinked and the machine may be
 * offline while the panorama and the rest of the UI still work.
 */
export default function RemoteImage({
  src,
  alt = '',
  label,
  style,
  position = 'center',
  fit = 'cover',
  respaldo
}: RemoteImageProps): JSX.Element {
  // Cuántas fuentes fallaron: primero `src`, después el respaldo.
  const [fallos, setFallos] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const fuente = [src, respaldo].filter(Boolean)[fallos]
  const showImage = Boolean(fuente)

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--gold) 16%, transparent), rgba(18,18,26,0.9) 62%), var(--surface-2)',
        ...style
      }}
    >
      {!showImage && label && (
        <span
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            fontSize: 30,
            fontWeight: 800,
            color: 'var(--gold)',
            opacity: 0.85
          }}
        >
          {label.trim().charAt(0).toUpperCase()}
        </span>
      )}

      {showImage && (
        <img
          key={fuente}
          src={fuente}
          alt={alt}
          draggable={false}
          onError={() => {
            setLoaded(false)
            setFallos((n) => n + 1)
          }}
          onLoad={() => setLoaded(true)}
          style={{
            position: 'absolute',
            // Inset rather than flush when contained: a logo pinned to the
            // edges of its panel looks like it overflowed.
            inset: fit === 'contain' ? 14 : 0,
            width: fit === 'contain' ? 'auto' : '100%',
            height: fit === 'contain' ? 'auto' : '100%',
            margin: fit === 'contain' ? 'auto' : undefined,
            maxWidth: fit === 'contain' ? 'calc(100% - 28px)' : undefined,
            maxHeight: fit === 'contain' ? 'calc(100% - 28px)' : undefined,
            objectFit: fit,
            objectPosition: position,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.35s ease'
          }}
        />
      )}
    </div>
  )
}
