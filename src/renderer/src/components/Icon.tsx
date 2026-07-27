export type IconName =
  | 'play'
  | 'mods'
  | 'settings'
  | 'logout'
  | 'search'
  | 'user'
  | 'chevron'
  | 'minimize'
  | 'maximize'
  | 'close'
  | 'globe'
  | 'package'
  | 'book'
  | 'refresh'
  | 'check'
  | 'download'
  | 'trash'
  | 'info'
  | 'warning'
  | 'gauge'
  | 'music'
  | 'shield'

/** Single-path outline icons, stroked with currentColor so they inherit state. */
const PATHS: Record<IconName, string> = {
  play: 'M6 4.5v15l13-7.5z',
  mods: 'M4 7h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6zM4 17h6v4H4z',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.1A1.7 1.7 0 0 0 10.13 3V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.03z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  chevron: 'M9 18l6-6-6-6',
  minimize: 'M5 12h14',
  maximize: 'M5 5h14v14H5z',
  close: 'M18 6L6 18M6 6l12 12',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z',
  package: 'M12 2.6l8.5 4.7v9.4L12 21.4 3.5 16.7V7.3zM3.8 7.2L12 11.8l8.2-4.6M12 11.8v9.4',
  book: 'M4 4.8A2.8 2.8 0 0 1 6.8 2H20v20H6.8A2.8 2.8 0 0 1 4 19.2zM4 17.4h16M8 6.6h7M8 10.2h7',
  refresh: 'M20.5 12a8.5 8.5 0 1 1-2.6-6.1M20.6 4v5h-5',
  check: 'M20 6.5L9.2 17.3 4 12.1',
  download: 'M12 3v11.5M7.5 10.5L12 15l4.5-4.5M4 20h16',
  trash: 'M4 6.5h16M9.5 6.5V4.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2.3M6.3 6.5L7.4 20a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9l1.1-13.5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11.2V16M12 7.7h.01',
  warning: 'M12 3.2l9.3 16.6H2.7zM12 9.4v4.4M12 17h.01',
  gauge: 'M3.6 18.2a9 9 0 1 1 16.8 0M12 12.6l4.6-3.8',
  music: 'M9.5 18.2V5.4l10-2v12.8M9.5 18.2a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0zM19.5 16.2a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0z',
  shield: 'M12 2.8l7.8 2.9v5.9c0 4.4-3.1 7.7-7.8 8.7-4.7-1-7.8-4.3-7.8-8.7V5.7z'
}

/** Icons drawn as filled shapes rather than strokes. */
const FILLED = new Set<IconName>(['play', 'mods'])

export interface IconProps {
  name: IconName
  size?: number
}

export default function Icon({ name, size = 16 }: IconProps): JSX.Element {
  const filled = FILLED.has(name)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
