/**
 * La barra de segmentos del ingreso, como la de Majestic: hechos y actual en
 * dorado, lo que falta en gris, y debajo en qué paso se está.
 *
 * @param etapas Los nombres de las etapas, en orden.
 * @param actual La etapa en la que se está, empezando en 0.
 */
export default function BarraPasos({
  etapas,
  actual
}: {
  etapas: string[]
  actual: number
}): JSX.Element {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {etapas.map((etapa, i) => (
          <span
            key={etapa}
            title={etapa}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= actual ? 'var(--gold)' : 'var(--surface-3)',
              transition: 'background 0.3s'
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 11.5, color: 'var(--text-faint)', textAlign: 'center' }}>
        Paso {actual + 1} de {etapas.length} · {etapas[actual]}
      </span>
    </div>
  )
}
