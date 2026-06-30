import { memo } from 'react'
import styles from './MissionControl.module.css'

const STATUS_LABELS = {
  idle: 'Standby',
  active: 'Active',
  review: 'Review',
  blocked: 'Blocked',
}

function clampProgress(value) {
  return Math.min(100, Math.max(0, Math.round(value || 0)))
}

function MissionControl({ mission, progress, status = 'idle', milestones = [] }) {
  const safeProgress = clampProgress(progress)
  const statusLabel = STATUS_LABELS[status] || STATUS_LABELS.idle

  return (
    <section className={`${styles.card} ${styles[status] || styles.idle}`} aria-label="Mission control">
      <div className={styles.header}>
        <span>Mission</span>
        <strong>{statusLabel}</strong>
      </div>

      <p className={styles.objective}>{mission}</p>

      <div className={styles.progressRow}>
        <span>Progress</span>
        <strong>{safeProgress}%</strong>
      </div>
      <progress
        aria-label="Mission progress"
        className={styles.progressTrack}
        max="100"
        value={safeProgress}
      />

      <ol className={styles.milestones}>
        {milestones.map((milestone) => (
          <li className={styles[milestone.state]} key={milestone.label}>
            <span aria-hidden="true">{getMilestoneGlyph(milestone.state)}</span>
            {milestone.label}
          </li>
        ))}
      </ol>
    </section>
  )
}

function getMilestoneGlyph(state) {
  if (state === 'done') {
    return '✓'
  }

  if (state === 'active') {
    return '→'
  }

  return '□'
}

export default memo(MissionControl)
