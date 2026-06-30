import { memo, useMemo, useState } from 'react'
import styles from './RivalAgent.module.css'

function RivalAgent({ alphaText, betaText, confidence, isLoading, verdict }) {
  const [expanded, setExpanded] = useState(true)

  const confidenceLabel = useMemo(() => `${Math.round(confidence)}%`, [confidence])

  return (
    <section className={`${styles.card} ${expanded ? styles.expanded : ''}`} aria-label="AI rival agent">
      <button className={styles.header} type="button" onClick={() => setExpanded((value) => !value)}>
        <span>AI Rival Agent</span>
        <strong>{expanded ? 'Collapse' : 'Expand'}</strong>
      </button>

      {expanded && (
        <div className={styles.body}>
          <div className={styles.stream}>
            <div className={styles.streamHead}>
              <span className={styles.alphaDot} aria-hidden="true" />
              <strong>Agent Alpha</strong>
            </div>
            <p>{isLoading ? 'Primary agent is assembling the main answer.' : alphaText}</p>
          </div>

          <div className={styles.stream}>
            <div className={styles.streamHead}>
              <span className={styles.betaDot} aria-hidden="true" />
              <strong>Agent Beta</strong>
            </div>
            <p>{isLoading ? 'Rival agent is preparing a counter-position.' : betaText}</p>
          </div>

          <div className={styles.verdict}>
            <span>Verdict</span>
            <strong>{verdict}</strong>
            <em>{confidenceLabel}</em>
          </div>
        </div>
      )}
    </section>
  )
}

export default memo(RivalAgent)
