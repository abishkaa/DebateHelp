import { memo, useEffect, useMemo, useState } from 'react'
import styles from './MemoryArchaeology.module.css'

const BASE_PROJECTS = [
  {
    id: 'basketball-academy',
    age: '4 months ago',
    title: 'Basketball Academy Website',
    reason: 'Sports, local community, and web design still connect to your current builder arc.',
  },
  {
    id: 'study-system',
    age: '3 months ago',
    title: 'Study System Dashboard',
    reason: 'Useful as a companion surface for your AI Operating System.',
  },
  {
    id: 'debate-vault',
    age: '2 months ago',
    title: 'Debate Evidence Vault',
    reason: 'Could become persistent memory for speeches, rebuttals, and source quality.',
  },
]

function MemoryArchaeology({ history = [], onResumeProject }) {
  const [index, setIndex] = useState(0)
  const [dismissed, setDismissed] = useState(() => new Set())

  const projects = useMemo(() => {
    const historyProject = history.find((message) => /project|website|dashboard|system/i.test(message.content))
    if (!historyProject) {
      return BASE_PROJECTS
    }

    return [
      {
        id: `history-${historyProject.created_at || historyProject.content.length}`,
        age: 'earlier this session',
        title: summarizeProject(historyProject.content),
        reason: 'This came from session memory and may be worth turning into a next-action plan.',
      },
      ...BASE_PROJECTS,
    ]
  }, [history])

  const visibleProjects = useMemo(
    () => projects.filter((project) => !dismissed.has(project.id)),
    [dismissed, projects],
  )

  useEffect(() => {
    if (visibleProjects.length <= 1) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % visibleProjects.length)
    }, 8500)

    return () => window.clearInterval(timer)
  }, [visibleProjects.length])

  if (visibleProjects.length === 0) {
    return null
  }

  const project = visibleProjects[index % visibleProjects.length]

  return (
    <section className={styles.card} aria-label="Memory archaeology">
      <div className={styles.header}>
        <span>Memory Archaeology</span>
        <strong>Resurfaced</strong>
      </div>

      <article className={styles.find} key={project.id}>
        <p>Found from {project.age}:</p>
        <h3>{project.title}</h3>
        <span>{project.reason}</span>
        <div className={styles.actions}>
          <button type="button" onClick={() => onResumeProject?.(project.title)}>
            Resume
          </button>
          <button
            className={styles.dismiss}
            type="button"
            onClick={() => setDismissed((current) => new Set([...current, project.id]))}
          >
            Dismiss
          </button>
        </div>
      </article>
    </section>
  )
}

function summarizeProject(content) {
  const cleaned = content.replace(/\s+/g, ' ').trim()
  return cleaned.length > 36 ? `${cleaned.slice(0, 33)}...` : cleaned
}

export default memo(MemoryArchaeology)
