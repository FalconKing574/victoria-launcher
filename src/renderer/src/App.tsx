import { useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import AmbientMusic from './components/AmbientMusic'
import TitleBar from './components/TitleBar'
import PanoramaBg from './components/PanoramaBg'
import SideNav, { type NavKey } from './components/SideNav'
import Splash from './screens/Splash'
import Login from './screens/Login'
import WhitelistGate from './screens/WhitelistGate'
import Home from './screens/Home'
import Mods from './screens/Mods'
import Settings from './screens/Settings'
import type { PremiumSession } from '@shared/api'

type Stage = 'splash' | 'login' | 'checking' | 'denied' | 'app'

interface Account {
  type: 'premium' | 'offline'
  username: string
  premium?: PremiumSession
}

export default function App(): JSX.Element {
  const [stage, setStage] = useState<Stage>('splash')
  const [account, setAccount] = useState<Account | null>(null)
  const [denyReason, setDenyReason] = useState('not_whitelisted')
  const [nav, setNav] = useState<NavKey>('play')

  const runAccessCheck = useCallback(async (next: Account): Promise<void> => {
    setStage('checking')
    // Remember who is being checked BEFORE the result. Storing it only on
    // success meant a first-time denial left `account` null, so "Volver a
    // comprobar" fell through to the login screen and the player had to
    // re-authenticate after staff whitelisted them.
    setAccount(next)
    try {
      const result =
        next.type === 'premium'
          ? await window.api.access.checkPremium(next.premium!.mcToken)
          : await window.api.access.checkOffline(next.username)

      if (result.allowed) {
        setStage('app')
      } else {
        setDenyReason(result.reason)
        setStage('denied')
      }
    } catch {
      setDenyReason('server_error')
      setStage('denied')
    }
  }, [])

  // Try a silent Microsoft re-login once the splash finishes.
  const handleSplashDone = useCallback(async (): Promise<void> => {
    const restored = await window.api.auth.microsoftRestore().catch(() => null)
    if (restored) {
      await runAccessCheck({ type: 'premium', username: restored.name, premium: restored })
    } else {
      setStage('login')
    }
  }, [runAccessCheck])

  const handleLogout = useCallback(async (): Promise<void> => {
    await window.api.auth.microsoftLogout()
    setAccount(null)
    setNav('play')
    setStage('login')
  }, [])

  const handleRetry = useCallback(() => {
    if (account) void runAccessCheck(account)
    else setStage('login')
  }, [account, runAccessCheck])

  return (
    <>
      <AmbientMusic />
      <PanoramaBg blur={stage === 'app' ? 14 : 6} />

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
                  runAccessCheck({ type: 'premium', username: session.name, premium: session })
                }
                onOffline={(username) => runAccessCheck({ type: 'offline', username })}
              />
            )}

            {stage === 'checking' && (
              <div
                key="checking"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  height: '100%',
                  color: 'var(--text-dim)'
                }}
              >
                Comprobando acceso al servidor...
              </div>
            )}

            {stage === 'denied' && (
              <WhitelistGate
                key="denied"
                reason={denyReason}
                onRetry={handleRetry}
                onLogout={handleLogout}
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
