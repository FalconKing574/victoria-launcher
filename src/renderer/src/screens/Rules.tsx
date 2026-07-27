import { motion } from 'framer-motion'
import Icon from '../components/Icon'
import Panel from '../components/Panel'
import { screenVariants } from '../theme/motion'
import { RULES, RULES_UPDATED } from '../data/rules'

export default function Rules(): JSX.Element {
  const total = RULES.reduce((count, category) => count + category.rules.length, 0)

  return (
    <motion.div
      variants={screenVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        padding: 26,
        height: '100%',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gap: 16
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>Reglas</h1>
          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            {RULES.length} categorías · {total} reglas · actualizado {RULES_UPDATED}
          </span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Al entrar a Victoria Kingdom aceptas estas normas. Léelas una vez: casi todos los baneos
          salen de las tres primeras categorías.
        </p>
      </div>

      <div style={{ overflowY: 'auto', display: 'grid', gap: 14, alignContent: 'start' }}>
        {RULES.map((category, categoryIndex) => (
          <Panel
            key={category.id}
            delay={0.04 * categoryIndex}
            style={{ padding: 16, display: 'grid', gap: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: 'rgba(230,180,34,0.12)',
                  color: 'var(--gold-bright)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0
                }}
              >
                <Icon name="book" size={15} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {categoryIndex + 1}. {category.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{category.summary}</div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  padding: '5px 9px',
                  borderRadius: 6,
                  background: 'var(--surface-3)',
                  color: 'var(--text-dim)',
                  flexShrink: 0
                }}
              >
                {category.rules.length} REGLAS
              </span>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              {category.rules.map((rule, ruleIndex) => (
                <div
                  key={rule}
                  className="row"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '10px 13px'
                  }}
                >
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: 'var(--gold)',
                      minWidth: 30,
                      flexShrink: 0,
                      lineHeight: 1.6,
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    {categoryIndex + 1}.{ruleIndex + 1}
                  </span>
                  <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-dim)' }}>
                    {rule}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        ))}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            fontSize: 12.5,
            color: 'var(--text-faint)'
          }}
        >
          <Icon name="info" size={15} />
          ¿Dudas con alguna regla? Pregunta en el Discord antes de arriesgarte a una sanción.
        </div>
      </div>
    </motion.div>
  )
}
