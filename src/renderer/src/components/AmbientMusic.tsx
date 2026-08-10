import { useEffect, useRef, useState } from 'react'
import ost from '../assets/ost.ogg'

export default function AmbientMusic(): JSX.Element | null {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const sync = (): void => {
      void window.api.settings
        .get()
        .then((settings) => setEnabled(settings.musicEnabled))
        // Without this a failed read is an unhandled rejection in the renderer,
        // and the music is the least important thing on screen.
        .catch(() => undefined)
    }
    sync()
    // The Settings screen fires this after saving so the toggle applies at once.
    window.addEventListener('settings-changed', sync)
    return () => window.removeEventListener('settings-changed', sync)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (enabled) {
      audio.volume = 0.25
      // Autoplay can still be refused; ignoring is fine since music is optional.
      void audio.play().catch(() => undefined)
    } else {
      audio.pause()
    }
  }, [enabled])

  // The element is only given a source once the music is actually on. Music is
  // off by default, and preloading meant every launch read and decoded a 2.7 MB
  // ogg that most players never hear -- during startup, competing with the
  // panorama and the session restore for the same few hundred milliseconds.
  return (
    <audio
      ref={audioRef}
      src={enabled ? ost : undefined}
      loop
      preload={enabled ? 'auto' : 'none'}
    />
  )
}
