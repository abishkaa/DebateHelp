import { memo, useMemo, useState } from 'react'
import styles from './FutureSimulator.module.css'

const PATHS = [
  {
    id: 'university',
    label: 'Path A',
    name: 'University',
    timeline: '4 years',
    difficulty: 'Medium',
    outcome: 'Structured credentials, research network, and internships.',
    confidenceOffset: 4,
  },
  {
    id: 'startup',
    label: 'Path B',
    name: 'Startup',
    timeline: '12-24 months',
    difficulty: 'High',
    outcome: 'Fast portfolio growth, intense ambiguity, direct market feedback.',
    confidenceOffset: -6,
  },
  {
    id: 'self-taught',
    label: 'Path C',
    name: 'Self-Taught',
    timeline: '18 months',
    difficulty: 'Medium-high',
    outcome: 'Strong agency, public projects, and uneven feedback unless mentored.',
    confidenceOffset: 1,
  },
]

function FutureSimulator({ confidence = 60, currentGoal }) {
  const [selectedPath, setSelectedPath] = useState(PATHS[0].id)

  const selected = useMemo(
    () => PATHS.find((path) => path.id === selectedPath) || PATHS[0],
    [selectedPath],
  )

  const pathConfidence = Math.min(95, Math.max(32, confidence + selected.confidenceOffset))

  return (
    <section className={styles.card} aria-label="Future simulator">
      <div className={styles.header}>
        <div>
          <span>Future Simulator</span>
          <strong>{currentGoal}</strong>
        </div>
        <em>{Math.round(pathConfidence)}%</em>
      </div>

      <div className={styles.paths}>
        {PATHS.map((path) => (
          <button
            className={selectedPath === path.id ? styles.selected : ''}
            key={path.id}
            type="button"
            onClick={() => setSelectedPath(path.id)}
          >
            <span>{path.label}</span>
            <strong>{path.name}</strong>
          </button>
        ))}
      </div>

      <div className={styles.outcome}>
        <div className={styles.timeline} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <dl>
          <div>
            <dt>Timeline</dt>
            <dd>{selected.timeline}</dd>
          </div>
          <div>
            <dt>Difficulty</dt>
            <dd>{selected.difficulty}</dd>
          </div>
          <div>
            <dt>Potential Outcome</dt>
            <dd>{selected.outcome}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

export default memo(FutureSimulator)
