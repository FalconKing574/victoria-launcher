import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import ArteCapturas from '../components/ArteCapturas'
import BarraPasos from '../components/BarraPasos'
import Button from '../components/Button'
import Campo from '../components/Campo'
import CodigoInput from '../components/CodigoInput'
import Icon from '../components/Icon'
import logo from '../assets/logo.png'
import {
  etapasIngreso,
  faltaCodigo,
  faltaContrasenas,
  faltaCorreo,
  faltaEntrar,
  faltaRegistro
} from '../lib/formulario-cuenta'
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
 * El aspecto sigue al launcher de Majestic (07-10-2026): panel a la izquierda y
 * capturas del servidor a la derecha, campos con ícono, código en casillas, y
 * un botón que dice qué falta en vez de quedarse apagado sin explicar nada.
 * Las reglas de forma están en `lib/formulario-cuenta.ts`; las que valen son las
 * del servidor: cualquier `mensaje` que vuelva se muestra tal cual.
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

const ETAPAS = etapasIngreso('NO_PREMIUM')

export default function Cuenta({
  onListo,
  sesionVencida,
  servidorCaido,
  onReintentar
}: CuentaProps): JSX.Element {
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

  const faltaReg = faltaRegistro({ nombre, contrasena, repetida, correo })
  const faltaLogin = faltaEntrar({ nombre, contrasena })
  const faltaCod = faltaCodigo(codigo)
  const faltaRecuperar = faltaCorreo(correo)
  const faltaNueva = faltaContrasenas(contrasena, repetida)

  async function registrar(): Promise<void> {
    const r = await pedir(() =>
      window.api.cuentas.registrar({ nombre, contrasena, correo: correo.trim() })
    )
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
    const r = await pedir(() => window.api.cuentas.confirmar({ correo: correo.trim(), codigo }))
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
      window.api.cuentas.restablecer({ correo: correo.trim(), codigo, contrasena })
    )
    if (r?.ok) onListo(r)
    else if (r?.error?.startsWith('codigo')) setVista('codigo')
  }

  const volver = (destino: Vista): JSX.Element => (
    <Button variant="ghost" full onClick={() => ir(destino)}>
      Volver
    </Button>
  )

  // La barra de pasos sólo en la creación de cuenta: entrar o recuperar no son
  // el ingreso de un jugador nuevo.
  const etapa = vista === 'registro' ? 0 : vista === 'codigo' && proposito === 'registro' ? 1 : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.4 } }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      style={{ display: 'grid', gridTemplateColumns: '420px 1fr', height: '100%' }}
    >
      <div
        style={{
          background: 'var(--bg-1)',
          borderRight: '1px solid var(--stroke)',
          padding: '24px 34px 20px',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          gap: 16,
          overflowY: 'auto'
        }}
      >
        <img
          src={logo}
          alt="Victoria Kingdom"
          style={{
            width: '100%',
            maxWidth: 210,
            justifySelf: 'center',
            imageRendering: 'pixelated'
          }}
        />

        <div style={{ display: 'grid', gap: 10, alignContent: 'center' }}>
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
              <Titulo
                titulo="Bienvenido a Victoria"
                texto="Entrá a tu cuenta o creá una nueva para jugar."
              />
              <AyudaCuenta />
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
            <Formulario onEnviar={() => faltaReg === null && void registrar()}>
              <Titulo
                titulo="Crear cuenta"
                texto="Completá tus datos. Te mandamos un código al correo."
              />
              <Campo
                etiqueta="Nombre en el juego"
                icono="user"
                placeholder="Así te van a ver en el servidor"
                valor={nombre}
                onCambio={setNombre}
                autoFocus
                maxLength={16}
              />
              <Campo
                etiqueta="Contraseña"
                tipo="password"
                icono="lock"
                placeholder="Mínimo 8 caracteres"
                valor={contrasena}
                onCambio={setContrasena}
                maxLength={72}
              />
              <Campo
                etiqueta="Repetí la contraseña"
                tipo="password"
                icono="lock"
                placeholder="La misma de arriba"
                valor={repetida}
                onCambio={setRepetida}
                maxLength={72}
              />
              <Campo
                etiqueta="Correo"
                tipo="email"
                icono="mail"
                placeholder="tu@correo.com"
                valor={correo}
                onCambio={setCorreo}
                nota="Sirve para recuperar la contraseña. Una cuenta por correo."
              />
              <Button type="submit" full loading={ocupado} disabled={faltaReg !== null}>
                {faltaReg ?? 'Crear cuenta'}
              </Button>
              {volver('inicio')}
            </Formulario>
          )}

          {vista === 'codigo' && (
            <Formulario onEnviar={() => faltaCod === null && void confirmar()}>
              <Titulo
                titulo="Revisá tu correo"
                texto={`Mandamos un código de 6 números a ${correoTapado || 'tu correo'}. Vence en 10 minutos.`}
              />
              <CodigoInput valor={codigo} onCambio={setCodigo} autoFocus />
              <div style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--text-dim)' }}>
                {reenvioEn > 0 ? (
                  <>
                    Reenviar en <b style={{ color: 'var(--text)' }}>{reenvioEn} s</b>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void reenviar()}
                    style={enlace}
                  >
                    Reenviar el código
                  </button>
                )}
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-faint)' }}>
                  Si no llega, mirá en spam o promociones.
                </div>
              </div>
              <Button type="submit" full loading={ocupado} disabled={faltaCod !== null}>
                {faltaCod ?? (proposito === 'recuperar' ? 'Seguir' : 'Confirmar')}
              </Button>
              {volver(proposito === 'recuperar' ? 'recuperar' : 'registro')}
            </Formulario>
          )}

          {vista === 'entrar' && (
            <Formulario onEnviar={() => faltaLogin === null && void entrar()}>
              <Titulo
                titulo="Entrar"
                texto="Con el nombre y la contraseña de tu cuenta de Victoria."
              />
              <Campo
                etiqueta="Nombre"
                icono="user"
                placeholder="Tu nombre en el juego"
                valor={nombre}
                onCambio={setNombre}
                autoFocus
                maxLength={16}
              />
              <Campo
                etiqueta="Contraseña"
                tipo="password"
                icono="lock"
                placeholder="Tu contraseña"
                valor={contrasena}
                onCambio={setContrasena}
                maxLength={72}
              />
              <Button type="submit" full loading={ocupado} disabled={faltaLogin !== null}>
                {faltaLogin ?? 'Entrar'}
              </Button>
              {volver('inicio')}
              <p
                style={{
                  margin: '2px 0 0',
                  textAlign: 'center',
                  fontSize: 12.5,
                  color: 'var(--text-faint)'
                }}
              >
                ¿Olvidaste tu contraseña?{' '}
                <button type="button" onClick={() => ir('recuperar')} style={enlaceFuerte}>
                  Recuperala
                </button>
              </p>
            </Formulario>
          )}

          {vista === 'recuperar' && (
            <Formulario onEnviar={() => faltaRecuperar === null && void recuperar()}>
              <Titulo
                titulo="Recuperar la cuenta"
                texto="Escribí el correo de tu cuenta y te mandamos un código."
              />
              <Campo
                etiqueta="Correo"
                tipo="email"
                icono="mail"
                placeholder="tu@correo.com"
                valor={correo}
                onCambio={setCorreo}
                autoFocus
              />
              <Button type="submit" full loading={ocupado} disabled={faltaRecuperar !== null}>
                {faltaRecuperar ?? 'Mandar código'}
              </Button>
              {volver('entrar')}
            </Formulario>
          )}

          {vista === 'restablecer' && (
            <Formulario onEnviar={() => faltaNueva === null && void restablecer()}>
              <Titulo
                titulo="Contraseña nueva"
                texto="Al cambiarla se cierra la sesión en las otras PC."
              />
              <Campo
                etiqueta="Contraseña nueva"
                tipo="password"
                icono="lock"
                placeholder="Mínimo 8 caracteres"
                valor={contrasena}
                onCambio={setContrasena}
                autoFocus
                maxLength={72}
              />
              <Campo
                etiqueta="Repetila"
                tipo="password"
                icono="lock"
                placeholder="La misma de arriba"
                valor={repetida}
                onCambio={setRepetida}
                maxLength={72}
              />
              <Button type="submit" full loading={ocupado} disabled={faltaNueva !== null}>
                {faltaNueva ?? 'Guardar y entrar'}
              </Button>
              {volver('codigo')}
            </Formulario>
          )}

          {error && <p style={textoError}>{error}</p>}
        </div>

        {etapa !== null ? (
          <BarraPasos etapas={ETAPAS} actual={etapa} />
        ) : (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>
            Minecraft 1.20.1 · Forge 47.4.0
          </p>
        )}
      </div>

      <ArteCapturas />
    </motion.div>
  )
}

function Titulo({ titulo, texto }: { titulo: string; texto: string }): JSX.Element {
  return (
    <div style={{ textAlign: 'center', marginBottom: 4 }}>
      <h1
        style={{
          margin: '0 0 6px',
          fontSize: 17,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: 'uppercase'
        }}
      >
        {titulo}
      </h1>
      <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.55 }}>{texto}</p>
    </div>
  )
}

/**
 * La duda más común del que llega: qué cuenta usar. Plegada para no ocupar
 * lugar, como el aviso del panel de Majestic.
 */
function AyudaCuenta(): JSX.Element {
  const [abierta, setAbierta] = useState(false)
  return (
    <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '11px 12px',
          background: 'none',
          border: 0,
          color: 'var(--text)',
          fontSize: 12.5,
          textAlign: 'left'
        }}
      >
        <span style={{ display: 'flex', color: 'var(--text-dim)' }}>
          <Icon name="info" size={16} />
        </span>
        <span style={{ flex: 1 }}>¿Qué cuenta uso? Hay dos formas de jugar.</span>
        <span
          style={{
            display: 'flex',
            color: 'var(--text-faint)',
            transform: `rotate(${abierta ? -90 : 90}deg)`,
            transition: 'transform 0.2s'
          }}
        >
          <Icon name="chevron" size={15} />
        </span>
      </button>
      {abierta && (
        <div
          style={{
            display: 'grid',
            gap: 8,
            padding: '0 14px 12px 38px',
            fontSize: 12.5,
            lineHeight: 1.6,
            color: 'var(--text-dim)'
          }}
        >
          <p style={{ margin: 0 }}>
            <b style={{ color: 'var(--text)' }}>Con Minecraft original:</b> entrá con tu cuenta de
            Microsoft. Tu nombre y tu skin salen de ahí.
          </p>
          <p style={{ margin: 0 }}>
            <b style={{ color: 'var(--text)' }}>Sin Minecraft original:</b> creá una cuenta de
            Victoria con nombre, contraseña y correo. Te mandamos un código para confirmar el
            correo.
          </p>
          <p style={{ margin: 0 }}>
            Después, las dos piden lo mismo: vincular Discord y aceptar las normas.
          </p>
        </div>
      )}
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

function Formulario({
  children,
  onEnviar
}: {
  children: React.ReactNode
  onEnviar: () => void
}): JSX.Element {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onEnviar()
      }}
      style={{ display: 'grid', gap: 10 }}
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
  cursor: 'pointer'
}

const enlaceFuerte: React.CSSProperties = {
  background: 'none',
  border: 0,
  padding: 0,
  color: 'var(--text)',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer'
}

const textoError: React.CSSProperties = {
  color: 'var(--err)',
  fontSize: 13,
  margin: 0,
  lineHeight: 1.5
}

const aviso: React.CSSProperties = {
  background: 'rgba(255, 92, 108, 0.1)',
  border: '1px solid rgba(255, 92, 108, 0.35)',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 12.5,
  color: 'var(--text)',
  lineHeight: 1.5
}
