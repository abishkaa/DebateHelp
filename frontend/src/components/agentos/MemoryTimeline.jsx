import { memo, useMemo, useState } from 'react'
import styles from './MemoryTimeline.module.css'

const BASE_EVENTS = [
  {
    id: 'skillswap',
    date: 'June 2026',
    event: 'Started SkillSwap',
    importance: 'high',
    detail: 'A remembered project thread with marketplace and collaboration potential.',
  },
  {
    id: 'agentos',
    date: 'June 2026',
    event: 'Built AI Operating System',
    importance: 'critical',
    detail: 'The current interface is evolving into a multi-agent command center.',
  },
]

function MemoryTimeline({ history = [] }) {
  const [expandedId, setExpandedId] = useState(BASE_EVENTS[1].id)

  const entries = useMemo(() => {
    const historyEvents = history
      .filter((message) => message.role === 'user')
      .slice(-4)
      .map((message, index) => ({
        id: `history-${message.created_at || index}`,
        date: formatMonth(message.created_at),
        event: summarizeMemory(message.content),
        importance: index >= 2 ? 'high' : 'medium',
        detail: message.content,
      }))

    return [...BASE_EVENTS, ...historyEvents]
  }, [history])

  return (
    <section className={styles.card} aria-label="Memory timeline">
      <div className={styles.header}>
        <span>Memory Timeline</span>
        <strong>{entries.length} events</strong>
      </div>

      <div className={styles.timeline}>
        {entries.map((entry) => {
          const expanded = expandedId === entry.id
          return (
            <article className={`${styles.entry} ${styles[entry.importance]}`} key={entry.id}>
              <button type="button" onClick={() => setExpandedId(expanded ? '' : entry.id)}>
                <span>{entry.date}</span>
                <strong>{entry.event}</strong>
                <em>{entry.importance}</em>
              </button>
              {expanded && <p>{entry.detail}</p>}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function summarizeMemory(content) {
  const cleaned = content.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= 52) {
    return cleaned
  }

  return `${cleaned.slice(0, 49)}...`
}

function formatMonth(value) {
  if (!value) {
    return 'Current session'
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'long',
      year: 'numeric',
    }).format(new Date(value))
  } catch {
    return 'Current session'
  }
}

export default memo(MemoryTimeline)
