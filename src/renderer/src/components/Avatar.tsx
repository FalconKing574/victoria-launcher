import { useState } from 'react'

export interface AvatarProps {
  username: string
  size: number
  radius: number
}

/**
 * The player's Minecraft head, with a fallback that is actually visible.
 *
 * The head comes from mc-heads.net, so it needs the network. This same img tag
 * plus onError handler was copy-pasted into SideNav and Settings, and both did
 * the same thing on failure: `visibility = 'hidden'`, which leaves a blank
 * square. Offline, that reads as an image that failed to load — because it is.
 * Showing the initial instead looks deliberate and keeps the row's shape.
 *
 * Note this sends the player's nick to a third party on every launch. It is the
 * only remaining outbound request the interface makes.
 */
export default function Avatar({ username, size, radius }: AvatarProps): JSX.Element {
  const [failed, setFailed] = useState(false)
  const initial = username.trim().charAt(0).toUpperCase() || '?'

  const box = {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
    background: 'var(--surface-3)'
  } as const

  if (failed) {
    return (
      <span
        aria-hidden="true"
        style={{
          ...box,
          display: 'grid',
          placeItems: 'center',
          color: 'var(--gold)',
          fontSize: Math.round(size * 0.45),
          fontWeight: 700
        }}
      >
        {initial}
      </span>
    )
  }

  return (
    <img
      src={`https://mc-heads.net/avatar/${encodeURIComponent(username)}/${size * 2}`}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      style={{ ...box, imageRendering: 'pixelated' }}
    />
  )
}
