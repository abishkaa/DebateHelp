import { memo, useEffect, useMemo, useState } from 'react'
import styles from './ReplayReasoning.module.css'

function ReplayReasoning({ disabled = false, steps = [] }) {
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)

  const maxPosition = Math.max(0, steps.length - 1)
  const activeStep = steps[position] || steps[0]

  useEffect(() => {
    if (!playing || disabled || steps.length === 0) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setPosition((current) => {
        if (current >= maxPosition) {
          setPlaying(false)
          return current
        }

        return current + 1
      })
    }, 900)

    return () => window.clearInterval(timer)
  }, [disabled, maxPosition, playing, steps.length])

  const label = useMemo(() => {
    if (disabled) {
      return 'Replay available after response'
    }

    return playing ? 'Replaying reasoning' : 'Replay reasoning'
  }, [disabled, playing])

  return (
    <section className={styles.card} aria-label="Replay reasoning">
      <div className={styles.header}>
        <span>Replay Reasoning</span>
        <strong>{label}</strong>
      </div>

      <div className={styles.controls}>
        <button type="button" disabled={disabled} onClick={() => setPlaying(true)}>
          Play
        </button>
        <button type="button" disabled={disabled} onClick={() => setPlaying(false)}>
          Pause
        </button>
        <input
          aria-label="Reasoning replay position"
          disabled={disabled}
          max={maxPosition}
          min="0"
          type="range"
          value={position}
          onChange={(event) => {
            setPlaying(false)
            setPosition(Number(event.target.value))
          }}
        />
      </div>

      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li className={index === position ? styles.active : index < position ? styles.done : ''} key={step.label}>
            <span>Step {index + 1}</span>
            <strong>{step.label}</strong>
          </li>
        ))}
      </ol>

      <p>{activeStep?.detail || 'Run the agent once to replay its reasoning timeline.'}</p>
    </section>
  )
}

export default memo(ReplayReasoning)
