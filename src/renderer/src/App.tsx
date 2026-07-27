import { useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import TitleBar from './components/TitleBar'
import PanoramaBg from './components/PanoramaBg'
import SideNav, { type NavKey } from './components/SideNav'
import Splash from './screens/Splash'
import Login from './screens/Login'
import Register from './screens/Register'
import WhitelistGate from './screens/WhitelistGate'
import Home from './screens/Home'
import Mods from './screens/Mods'
import Settings from './screens/Settings'
import type { LauncherProfile, PremiumSession } from '@shared/api'

type Stage = 'splash' | 'login' | 'register' | 'checking' | 'denied' | 'app'

interface Account {
  type: 'premium' | 'custom'
  username: string
  premium?: PremiumSession
  profile?: LauncherProfile
}

export default function App(): JSX.Element {
  const [stage, setStage] = useState<Stage>('splash')
  const [account, setAccount] = useState<Account | null>(null)
  const [denyReason, setDenyReason] = useState('not_whitelisted')
  const [nav, setNav] = useState<NavKey>('play')

  const runAccessCheck = useCallback(async (next: Account): Promise<void> => {
    setStage('checking')
    try {
      const result =
        next.type === 'premium'
          ? await window.api.access.checkPremium(next.premium!.mcToken)
          : await window.api.access.checkCustom()

      if (result.allowed) {
        setAccount(next)
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
    await window.api.account.logout()
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
                onCustom={(profile) =>
                  runAccessCheck({
                    type: 'custom',
                    username: profile.minecraft_username,
                    profile
                  })
                }
                onGoRegister={() => setStage('register')}
              />
            )}

            {stage === 'register' && (
              <Register
                key="register"
                onBack={() => setStage('login')}
                onComplete={(profile) =>
                  runAccessCheck({
                    type: 'custom',
                    username: profile.minecraft_username,
                    profile
                  })
                }
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
                          account.type === 'custom' ? account.username : undefined
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
