import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import Button from '../components/Button'
import { screenVariants } from '../theme/motion'

const MESSAGES: Record<string, string> = {
  not_whitelisted: 'Tu cuenta no está en la whitelist del servidor.',
  invalid_minecraft_token: 'La sesión de Minecraft no es válida. Vuelve a iniciar sesión.',
  invalid_username: 'Ese nombre de usuario no es válido.',
  mojang_unavailable: 'Los servidores de Mojang no responden. Inténtalo en unos minutos.',
  server_error: 'Hubo un problema al comprobar tu acceso. Inténtalo más tarde.'
}

export interface WhitelistGateProps {
  reason: string
  onRetry: () => void
  onLogout: () => void
}

export default function WhitelistGate({
  reason,
  onRetry,
  onLogout
}: WhitelistGateProps): JSX.Element {
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

        <p style={{ margin: 0, color: 'var(--text-faint)', fontSize: 13 }}>
          Si crees que es un error, abre un ticket en el Discord de Victoria Kingdom.
        </p>

        <div style={{ display: 'grid', gap: 10 }}>
          <Button full onClick={onRetry}>
            Volver a comprobar
          </Button>
          <Button variant="ghost" full onClick={onLogout}>
            Volver
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  )
}
