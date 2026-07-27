import { useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import AmbientMusic from './components/AmbientMusic'
import TitleBar from './components/TitleBar'
import PanoramaBg from './components/PanoramaBg'
import SideNav, { type NavKey } from './components/SideNav'
import Splash from './screens/Splash'
import Login from './screens/Login'
import Home from './screens/Home'
import Mods from './screens/Mods'
import Settings from './screens/Settings'
import type { PremiumSession } from '@shared/api'

type Stage = 'splash' | 'login' | 'app'

interface Account {
  type: 'premium' | 'offline'
  username: string
  premium?: PremiumSession
}

export default function App(): JSX.Element {
  const [stage, setStage] = useState<Stage>('splash')
  const [account, setAccount] = useState<Account | null>(null)
  const [nav, setNav] = useState<NavKey>('play')

  const signIn = useCallback((next: Account): void => {
    setAccount(next)
    setStage('app')
  }, [])

  // Try a silent Microsoft re-login once the splash finishes.
  const handleSplashDone = useCallback(async (): Promise<void> => {
    const restored = await window.api.auth.microsoftRestore().catch(() => null)
    if (restored) {
      signIn({ type: 'premium', username: restored.name, premium: restored })
    } else {
      setStage('login')
    }
  }, [signIn])

  const handleLogout = useCallback(async (): Promise<void> => {
    await window.api.auth.microsoftLogout()
    setAccount(null)
    setNav('play')
    setStage('login')
  }, [])

  return (
    <>
      <AmbientMusic />
      <PanoramaBg dim={stage === 'app' ? 0.86 : 0.66} />

      <div
        style={{
          position: 'relative',
          zIndex: 10,
          height: '100vh',
          display: 'grid',
          gridTemplateRows: 'auto 1fr'
        }}
      >
        <TitleBar />

        <div style={{ overflow: 'hidden' }}>
          <AnimatePresence mode="wait">
            {stage === 'splash' && <Splash key="splash" onDone={handleSplashDone} />}

            {stage === 'login' && (
              <Login
                key="login"
                onPremium={(session) =>
                  signIn({ type: 'premium', username: session.name, premium: session })
                }
                onOffline={(username) => signIn({ type: 'offline', username })}
              />
            )}

            {stage === 'app' && account && (
              <div key="app" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', height: '100%' }}>
                <SideNav
                  active={nav}
                  onSelect={setNav}
                  username={account.username}
                  accountType={account.type}
                  onLogout={handleLogout}
                />
                <div style={{ overflow: 'hidden' }}>
                  <AnimatePresence mode="wait">
                    {nav === 'play' && (
                      <Home
                        key="play"
                        username={account.username}
                        mclcUser={account.premium?.mclc}
                        offlineUsername={
                          account.type === 'offline' ? account.username : undefined
                        }
                      />
                    )}
                    {nav === 'mods' && <Mods key="mods" />}
                    {nav === 'settings' && <Settings key="settings" />}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
