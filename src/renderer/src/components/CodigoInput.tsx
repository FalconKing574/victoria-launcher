import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { LARGO_CODIGO, limpiarCodigo } from '../lib/formulario-cuenta'

/**
 * El código del correo en seis casillas, como en Majestic.
 *
 * Por debajo es UN solo `<input>` transparente que tapa las casillas: así pegar
 * el código entero, borrar o el autocompletado de Windows funcionan solos, y las
 * casillas sólo dibujan lo escrito. Con seis inputs de verdad cada una de esas
 * cosas había que programarla aparte.
 */
export default function CodigoInput({
  valor,
  onCambio,
  autoFocus
}: {
  valor: string
  onCambio: (valor: string) => void
  autoFocus?: boolean
}): JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  const [foco, setFoco] = useState(false)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  const actual = Math.min(valor.length, LARGO_CODIGO - 1)

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', gap: 8 }}>
      {Array.from({ length: LARGO_CODIGO }, (_, i) => {
        const activa = foco && i === actual && valor.length < LARGO_CODIGO
        return (
          <div
            key={i}
            style={{
              width: 46,
              height: 54,
              // Dos grupos de tres, que es como se lee un código en voz alta.
              marginLeft: i === LARGO_CODIGO / 2 ? 8 : 0,
              borderRadius: 'var(--r-md)',
              background: 'var(--campo)',
              // Blanco y no el acento, igual que los campos: rojo parecería error.
              border: `1px solid ${activa ? 'rgba(255, 255, 255, 0.42)' : 'transparent'}`,
              display: 'grid',
              placeItems: 'center',
              fontSize: 22,
              fontWeight: 700,
              transition: 'border-color 0.16s'
            }}
          >
            {valor[i] ??
              (activa ? (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ repeat: Infinity, duration: 1.05 }}
                  style={{ width: 2, height: 22, background: 'var(--text)' }}
                />
              ) : (
                <span style={{ color: 'var(--text-faint)', fontSize: 14 }}>·</span>
              ))}
          </div>
        )
      })}
      <input
        ref={ref}
        value={valor}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label={`Código de ${LARGO_CODIGO} números`}
        spellCheck={false}
        // Sin maxLength: un «123 456» pegado mide 7 y el navegador lo cortaría
        // antes de limpiarlo. Lo recorta limpiarCodigo.
        onChange={(e) => onCambio(limpiarCodigo(e.target.value))}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          border: 0,
          padding: 0,
          cursor: 'text',
          caretColor: 'transparent',
          fontSize: 16
        }}
      />
    </div>
  )
}
