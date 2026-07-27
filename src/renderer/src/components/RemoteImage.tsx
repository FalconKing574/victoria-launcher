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
  position = 'center'
}: RemoteImageProps): JSX.Element {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const showImage = Boolean(src) && !failed

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, rgba(230,180,34,0.16), rgba(18,18,26,0.9) 62%), var(--surface-2)',
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
          src={src}
          alt={alt}
          draggable={false}
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: position,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.35s ease'
          }}
        />
      )}
    </div>
  )
}
