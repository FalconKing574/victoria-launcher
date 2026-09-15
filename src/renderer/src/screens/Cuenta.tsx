import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Button from '../components/Button'
import Campo from '../components/Campo'
import logo from '../assets/logo.png'
import art from '../assets/victoria.png'
import type { PremiumSession, RespuestaCuenta } from '@shared/api'

/**
 * Entrar o crear la cuenta de Victoria. Reemplaza al login de "escribí un nick".
 *
 * Tres caminos desde el inicio:
 *
 * - **Minecraft original**: Microsoft y listo. El nombre lo dice Mojang.
 * - **Crear cuenta**: nombre, contraseña y correo, y un código que llega al correo.
 * - **Ya tengo cuenta**: nombre y contraseña; desde ahí, recuperar con el correo.
 *
 * Las reglas de forma se muestran acá para ahorrar un viaje, pero las que valen
 * son las del servidor: cualquier `mensaje` que vuelva se muestra tal cual.
 */

type Vista = 'inicio' | 'registro' | 'codigo' | 'entrar' | 'recuperar' | 'restablecer'

export interface CuentaProps {
  /** Entró o creó la cuenta. Si es premium, viene la sesión de Microsoft. */
  onListo: (respuesta: RespuestaCuenta, premium?: PremiumSession) => void
  /** La sesión de Microsoft guardada ya no sirve y hay que volver a entrar. */
  sesionVencida?: boolean
  /** El servidor de cuentas no contestó al abrir el launcher. */
  servidorCaido?: boolean
  onReintentar?: () => void
}

const NOMBRE = /^[A-Za-z0-9_]{3,16}$/
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

export default function Cuenta({ onListo, sesionVencida, servidorCaido, onReintentar }: CuentaProps): JSX.Element {
  const [vista, setVista] = useState<Vista>('inicio')
  const [nombre, setNombre] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [repetida, setRepetida] = useState('')
  const [correo, setCorreo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [proposito, setProposito] = useState<'registro' | 'recuperar'>('registro')
  const [correoTapado, setCorreoTapado] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(
    sesionVencida ? 'Tu sesión de Microsoft venció. Entrá de nuevo con Microsoft.' : null
  )
  const [reenvioEn, setReenvioEn] = useState(0)

  useEffect(() => {
    if (reenvioEn <= 0) return
    const t = setTimeout(() => setReenvioEn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [reenvioEn])

  function ir(v: Vista): void {
    setError(null)
    setVista(v)
  }

  async function pedir(fn: () => Promise<RespuestaCuenta>): Promise<RespuestaCuenta | null> {
    setError(null)
    setOcupado(true)
    try {
      const r = await fn()
      if (!r.ok) setError(r.mensaje ?? 'Algo salió mal. Probá de nuevo.')
      return r
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setOcupado(false)
    }
  }

  async function microsoft(): Promise<void> {
    setError(null)
    setOcupado(true)
    try {
      const sesion = await window.api.auth.microsoftLogin()
      const r = await window.api.cuentas.premium(sesion.mcToken)
      if (r.ok || r.error === 'sancion') onListo(r, sesion)
      else setError(r.mensaje ?? 'No se pudo entrar.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const problemaRegistro = ((): string | null => {
    if (nombre && !NOMBRE.test(nombre)) return 'El nombre: de 3 a 16 caracteres, letras, números o guion bajo.'
    if (contrasena && contrasena.length < 8) return 'La contraseña tiene que tener 8 caracteres o más.'
    if (repetida && repetida !== contrasena) return 'Las contraseñas no coinciden.'
    if (correo && !CORREO.test(correo.trim())) return 'Ese correo no parece válido.'
    return null
  })()
  const registroCompleto = NOMBRE.test(nombre) && contrasena.length >= 8 && repetida === contrasena && CORREO.test(correo.trim())

  async function registrar(): Promise<void> {
    const r = await pedir(() => window.api.cuentas.registrar({ nombre, contrasena, correo: correo.trim() }))
    if (r?.ok) {
      setCorreoTapado(r.correo ?? '')
      setProposito('registro')
      setCodigo('')
      setReenvioEn(60)
      setVista('codigo')
    } else if (r?.error === 'sancion') {
      onListo(r)
    }
  }

  async function confirmar(): Promise<void> {
    if (proposito === 'recuperar') {
      // El código se comprueba junto con la contraseña nueva: gastarlo antes
      // obligaría a pedir otro correo si la contraseña sale corta.
      setContrasena('')
      setRepetida('')
      setVista('restablecer')
      return
    }
    const r = await pedir(() => window.api.cuentas.confirmar({ correo: correo.trim(), codigo: codigo.trim() }))
    if (r?.ok || r?.error === 'sancion') onListo(r)
  }

  async function reenviar(): Promise<void> {
    const r = await pedir(() => window.api.cuentas.reenviar({ correo: correo.trim(), proposito }))
    if (r?.ok) setReenvioEn(60)
  }

  async function entrar(): Promise<void> {
    const r = await pedir(() => window.api.cuentas.entrar({ nombre, contrasena }))
    if (r?.ok) onListo(r)
  }

  async function recuperar(): Promise<void> {
    const r = await pedir(() => window.api.cuentas.recuperar(correo.trim()))
    if (r?.ok) {
      setCorreoTapado(r.correo ?? '')
      setProposito('recuperar')
      setCodigo('')
      setReenvioEn(60)
      setVista('codigo')
    }
  }

  async function restablecer(): Promise<void> {
    const r = await pedir(() =>
      window.api.cuentas.restablecer({ correo: correo.trim(), codigo: codigo.trim(), contrasena })
    )
    if (r?.ok) onListo(r)
    else if (r?.error?.startsWith('codigo')) setVista('codigo')
  }

  const volver = (destino: Vista): JSX.Element => (
    <button type="button" className="link" onClick={() => ir(destino)} style={enlace}>
      ← Volver
    </button>
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      style={{ display: 'grid', gridTemplateColumns: '440px 1fr', height: '100%' }}
    >
      <div
        style={{
          background: 'var(--bg-1)',
          borderRight: '1px solid var(--stroke)',
          padding: '34px 34px',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          gap: 20,
          overflowY: 'auto'
        }}
      >
        <img
          src={logo}
          alt="Victoria Kingdom"
          style={{ width: '100%', maxWidth: 280, justifySelf: 'center', imageRendering: 'pixelated' }}
        />

        <div style={{ display: 'grid', gap: 16, alignContent: 'center' }}>
          {servidorCaido && (
            <div style={aviso}>
              El servidor de Victoria no responde. Sin él no se puede entrar ni jugar.
              {onReintentar && (
                <button type="button" onClick={onReintentar} style={{ ...enlace, marginLeft: 6 }}>
                  Reintentar
                </button>
              )}
            </div>
          )}

          {vista === 'inicio' && (
            <>
              <Titulo titulo="Bienvenido a Victoria" texto="Para jugar necesitás una cuenta de Victoria." />
              <Button variant="microsoft" full loading={ocupado} onClick={() => void microsoft()}>
                Tengo Minecraft original (Microsoft)
              </Button>
              <Separador texto="sin Minecraft original" />
              <Button full onClick={() => ir('registro')}>
                Crear cuenta
              </Button>
              <Button variant="ghost" full onClick={() => ir('entrar')}>
                Ya tengo cuenta
              </Button>
            </>
          )}

          {vista === 'registro' && (
            <Formulario onEnviar={() => registroCompleto && void registrar()}>
              <Titulo titulo="Crear cuenta" texto="Te vamos a mandar un código al correo." />
              <Campo etiqueta="Nombre en el juego" valor={nombre} onCambio={setNombre} autoFocus maxLength={16} />
              <Campo etiqueta="Contraseña" tipo="password" valor={contrasena} onCambio={setContrasena} maxLength={72} />
              <Campo etiqueta="Repetí la contraseña" tipo="password" valor={repetida} onCambio={setRepetida} maxLength={72} />
              <Campo
                etiqueta="Correo"
                tipo="email"
                valor={correo}
                onCambio={setCorreo}
                nota="Sirve para recuperar la contraseña. Una cuenta por correo."
              />
              {problemaRegistro && <p style={textoError}>{problemaRegistro}</p>}
              <Button type="submit" full loading={ocupado} disabled={!registroCompleto}>
                Crear cuenta
              </Button>
              {volver('inicio')}
            </Formulario>
          )}

          {vista === 'codigo' && (
            <Formulario onEnviar={() => codigo.trim().length === 6 && void confirmar()}>
              <Titulo
                titulo="Revisá tu correo"
                texto={`Mandamos un código de 6 números a ${correoTapado || 'tu correo'}. Vence en 10 minutos.`}
              />
              <Campo
                etiqueta="Código"
                valor={codigo}
                onCambio={(v) => setCodigo(v.replace(/\D/g, ''))}
                autoFocus
                maxLength={6}
                inputMode="numeric"
                nota="Si no llega, mirá en spam o promociones."
              />
              <Button type="submit" full loading={ocupado} disabled={codigo.trim().length !== 6}>
                {proposito === 'recuperar' ? 'Seguir' : 'Confirmar'}
              </Button>
              <button type="button" disabled={reenvioEn > 0 || ocupado} onClick={() => void reenviar()} style={enlace}>
                {reenvioEn > 0 ? `Reenviar el código en ${reenvioEn} s` : 'Reenviar el código'}
              </button>
              {volver(proposito === 'recuperar' ? 'recuperar' : 'registro')}
            </Formulario>
          )}

          {vista === 'entrar' && (
            <Formulario onEnviar={() => nombre && contrasena && void entrar()}>
              <Titulo titulo="Entrar" texto="Con el nombre y la contraseña de tu cuenta de Victoria." />
              <Campo etiqueta="Nombre" valor={nombre} onCambio={setNombre} autoFocus maxLength={16} />
              <Campo etiqueta="Contraseña" tipo="password" valor={contrasena} onCambio={setContrasena} maxLength={72} />
              <Button type="submit" full loading={ocupado} disabled={!nombre || !contrasena}>
                Entrar
              </Button>
              <button type="button" onClick={() => ir('recuperar')} style={enlace}>
                Olvidé mi contraseña
              </button>
              {volver('inicio')}
            </Formulario>
          )}

          {vista === 'recuperar' && (
            <Formulario onEnviar={() => CORREO.test(correo.trim()) && void recuperar()}>
              <Titulo titulo="Recuperar la cuenta" texto="Escribí el correo de tu cuenta y te mandamos un código." />
              <Campo etiqueta="Correo" tipo="email" valor={correo} onCambio={setCorreo} autoFocus />
              <Button type="submit" full loading={ocupado} disabled={!CORREO.test(correo.trim())}>
                Mandar código
              </Button>
              {volver('entrar')}
            </Formulario>
          )}

          {vista === 'restablecer' && (
            <Formulario onEnviar={() => contrasena.length >= 8 && contrasena === repetida && void restablecer()}>
              <Titulo titulo="Contraseña nueva" texto="Al cambiarla se cierra la sesión en las otras PC." />
              <Campo etiqueta="Contraseña nueva" tipo="password" valor={contrasena} onCambio={setContrasena} autoFocus maxLength={72} />
              <Campo etiqueta="Repetila" tipo="password" valor={repetida} onCambio={setRepetida} maxLength={72} />
              {repetida && repetida !== contrasena && <p style={textoError}>Las contraseñas no coinciden.</p>}
              <Button type="submit" full loading={ocupado} disabled={contrasena.length < 8 || contrasena !== repetida}>
                Guardar y entrar
              </Button>
              {volver('codigo')}
            </Formulario>
          )}

          {error && <p style={textoError}>{error}</p>}
        </div>

        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.6 }}>
          Minecraft 1.20.1 · Forge 47.4.0
        </p>
      </div>

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          src={art}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 28%' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, rgba(13,13,20,0.85), rgba(13,13,20,0.15) 45%, rgba(13,13,20,0.55))'
          }}
        />
        <div style={{ position: 'absolute', left: 34, bottom: 30, right: 34 }}>
          <p className="eyebrow" style={{ margin: '0 0 6px' }}>
            Servidor oficial
          </p>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.4, textShadow: '0 2px 20px rgba(0,0,0,0.6)' }}>
            Victoria Kingdom
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function Titulo({ titulo, texto }: { titulo: string; texto: string }): JSX.Element {
  return (
    <div style={{ textAlign: 'center' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 21, fontWeight: 700 }}>{titulo}</h1>
      <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>{texto}</p>
    </div>
  )
}

function Separador({ texto }: { texto: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
      <span className="eyebrow">{texto}</span>
      <span style={{ flex: 1, height: 1, background: 'var(--stroke)' }} />
    </div>
  )
}

function Formulario({ children, onEnviar }: { children: React.ReactNode; onEnviar: () => void }): JSX.Element {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onEnviar()
      }}
      style={{ display: 'grid', gap: 12 }}
    >
      {children}
    </form>
  )
}

const enlace: React.CSSProperties = {
  background: 'none',
  border: 0,
  padding: 0,
  color: 'var(--text-dim)',
  fontSize: 12.5,
  textDecoration: 'underline',
  cursor: 'pointer',
  justifySelf: 'center'
}

const textoError: React.CSSProperties = { color: 'var(--err)', fontSize: 13, margin: 0, lineHeight: 1.5 }

const aviso: React.CSSProperties = {
  background: 'rgba(255, 92, 108, 0.1)',
  border: '1px solid rgba(255, 92, 108, 0.35)',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 12.5,
  color: 'var(--text)',
  lineHeight: 1.5
}
