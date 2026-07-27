import { useEffect, useRef, useState } from 'react'
import ost from '../assets/ost.ogg'

export default function AmbientMusic(): JSX.Element | null {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const sync = (): void => {
      void window.api.settings.get().then((settings) => setEnabled(settings.musicEnabled))
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

  return <audio ref={audioRef} src={ost} loop preload="auto" />
}
