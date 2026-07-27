import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import Button from '../components/Button'
import DiscordLinkStep from '../components/DiscordLinkStep'
import { screenVariants } from '../theme/motion'
import type { LauncherProfile } from '@shared/api'

const MESSAGES: Record<string, string> = {
  not_whitelisted: 'Tu cuenta no está en la whitelist del servidor.',
  discord_not_linked: 'Tienes que vincular tu cuenta de Discord antes de entrar.',
  invalid_minecraft_token: 'La sesión de Minecraft no es válida. Vuelve a iniciar sesión.',
  no_profile: 'No encontramos tu perfil. Vuelve a iniciar sesión.',
  unauthenticated: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  server_error: 'Hubo un problema al comprobar tu acceso. Inténtalo más tarde.'
}

export interface WhitelistGateProps {
  reason: string
  onRetry: () => void
  onLogout: () => void
  /** Rendered when the account exists but never finished linking Discord. */
  onLinkDiscord?: (profile: LauncherProfile) => void
}

export default function WhitelistGate({
  reason,
  onRetry,
  onLogout,
  onLinkDiscord
}: WhitelistGateProps): JSX.Element {
  // Registration creates the account before the Discord step, so a user who
  // closed that window is stuck: this is the only place they can finish it.
  const needsDiscord = reason === 'discord_not_linked' && onLinkDiscord !== undefined
  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{ display: 'grid', placeItems: 'center', height: '100%' }}
    >
      <GlassCard style={{ width: 440, display: 'grid', gap: 20, textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          style={{
            width: 74,
            height: 74,
            borderRadius: '50%',
            justifySelf: 'center',
            display: 'grid',
            placeItems: 'center',
            fontSize: 32,
            background: 'rgba(255,92,108,0.12)',
            border: '1px solid rgba(255,92,108,0.35)'
          }}
        >
          🔒
        </motion.div>

        <div>
          <h2 style={{ margin: '0 0 10px' }}>Acceso denegado</h2>
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6 }}>
            {MESSAGES[reason] ?? 'No tienes acceso al servidor.'}
          </p>
        </div>

        {needsDiscord ? (
          <DiscordLinkStep onLinked={onLinkDiscord!} />
        ) : (
          <p style={{ margin: 0, color: 'var(--text-faint)', fontSize: 13 }}>
            Si crees que es un error, abre un ticket en el Discord de Victoria Kingdom.
          </p>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {!needsDiscord && (
            <Button full onClick={onRetry}>
              Volver a comprobar
            </Button>
          )}
          <Button variant="ghost" full onClick={onLogout}>
            Cerrar sesión
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  )
}
