import { memo, useMemo } from 'react'
import styles from './AgentDashboard.module.css'

function AgentDashboard({
  activeMission,
  confidence,
  currentState,
  memoryCount,
  opportunitiesFound,
  reasoningSteps,
  sessionDuration,
  status,
}) {
  const metrics = useMemo(() => ([
    { label: 'Confidence', value: `${Math.round(confidence)}%` },
    { label: 'Current State', value: currentState },
    { label: 'Active Mission', value: activeMission },
    { label: 'Memory Count', value: memoryCount },
    { label: 'Opportunities', value: opportunitiesFound },
    { label: 'Reasoning Steps', value: reasoningSteps },
    { label: 'Session Time', value: sessionDuration },
  ]), [
    activeMission,
    confidence,
    currentState,
    memoryCount,
    opportunitiesFound,
    reasoningSteps,
    sessionDuration,
  ])

  return (
    <section className={styles.card} aria-label="Agent dashboard">
      <div className={styles.header}>
        <span>Agent Dashboard</span>
        <strong className={styles[status]}>{status}</strong>
      </div>

      <div className={styles.metrics}>
        {metrics.map((metric) => (
          <div className={styles.metric} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

export default memo(AgentDashboard)
