import { memo, useEffect, useMemo, useState } from 'react'
import styles from './OpportunityScanner.module.css'

const DEFAULT_DISCOVERIES = [
  {
    id: 'climate-ai-scholarship',
    ingredients: ['NASA Project', 'Python', 'Machine Learning'],
    title: 'Climate AI Scholarship',
    priority: 'high',
  },
  {
    id: 'debate-evidence-sprint',
    ingredients: ['Debate', 'Research', 'Writing'],
    title: 'National Debate Evidence Sprint',
    priority: 'medium',
  },
  {
    id: 'agentos-portfolio',
    ingredients: ['React', 'Agent UI', 'Python Backend'],
    title: 'AgentOS Portfolio Demo',
    priority: 'high',
  },
]

function OpportunityScanner({ activeMissions = [], history = [], userGoals = [], userSkills = [] }) {
  const [activeIndex, setActiveIndex] = useState(0)

  const discoveries = useMemo(() => {
    const text = history.map((message) => message.content).join(' ').toLowerCase()
    const generated = [...DEFAULT_DISCOVERIES]

    if (text.includes('phone') || text.includes('school')) {
      generated.push({
        id: 'attention-policy-brief',
        ingredients: ['Education', 'Policy', 'Evidence'],
        title: 'Attention Policy Brief',
        priority: 'medium',
      })
    }

    if (text.includes('ai') || userSkills.some((skill) => skill.toLowerCase().includes('ai'))) {
      generated.push({
        id: 'ai-engineer-roadmap',
        ingredients: ['AI', 'Projects', 'Career'],
        title: 'AI Engineer Roadmap',
        priority: 'high',
      })
    }

    if (activeMissions.length > 0 || userGoals.length > 0) {
      generated.push({
        id: 'mission-proof-pack',
        ingredients: ['Current Mission', 'Memory', 'Execution'],
        title: 'Mission Proof Pack',
        priority: 'low',
      })
    }

    return generated.map((item, index) => ({
      ...item,
      timestamp: formatScanTime(index),
    }))
  }, [activeMissions.length, history, userGoals.length, userSkills])

  useEffect(() => {
    if (discoveries.length <= 1) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % discoveries.length)
    }, 4200)

    return () => window.clearInterval(timer)
  }, [discoveries.length])

  const visibleDiscoveries = useMemo(() => {
    if (discoveries.length <= 3) {
      return discoveries
    }

    return [
      discoveries[activeIndex],
      discoveries[(activeIndex + 1) % discoveries.length],
      discoveries[(activeIndex + 2) % discoveries.length],
    ]
  }, [activeIndex, discoveries])

  return (
    <section className={styles.card} aria-label="Opportunity scanner">
      <div className={styles.header}>
        <div>
          <span>Opportunity Scanner</span>
          <strong>Live discovery engine</strong>
        </div>
        <em>{discoveries.length} found</em>
      </div>

      <div className={styles.feed}>
        {visibleDiscoveries.map((discovery) => (
          <article className={styles.discovery} key={`${activeIndex}-${discovery.id}`}>
            <div className={styles.discoveryTop}>
              <span className={`${styles.badge} ${styles[discovery.priority]}`}>{discovery.priority}</span>
              <time>{discovery.timestamp}</time>
            </div>
            <div className={styles.ingredients}>
              {discovery.ingredients.map((ingredient, index) => (
                <span key={ingredient}>
                  {ingredient}
                  {index < discovery.ingredients.length - 1 ? <b>+</b> : null}
                </span>
              ))}
            </div>
            <p>Potential Opportunity:</p>
            <strong>{discovery.title}</strong>
          </article>
        ))}
      </div>
    </section>
  )
}

function formatScanTime(offset) {
  const date = new Date(Date.now() - offset * 60000)
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default memo(OpportunityScanner)
