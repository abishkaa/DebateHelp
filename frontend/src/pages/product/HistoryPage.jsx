import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Search, TrendingUp } from 'lucide-react'
import { famousDebates, recentSessions } from '../../data/productData.js'
import { productApi } from '../../services/productApi.js'
import { PageHeading } from './OverviewPage.jsx'

function HistoryPage({ navigateTo, token }) {
  const [query, setQuery] = useState('')
  const [liveSessions, setLiveSessions] = useState([])
  const [syncing, setSyncing] = useState(Boolean(token))

  useEffect(() => {
    let active = true
    if (!token) {
      setSyncing(false)
      return undefined
    }

    productApi.sessions(token)
      .then((data) => {
        if (active) setLiveSessions(data.sessions || [])
      })
      .catch(() => null)
      .finally(() => {
        if (active) setSyncing(false)
      })

    return () => {
      active = false
    }
  }, [token])

  const sessions = useMemo(() => {
    if (liveSessions.length === 0) return recentSessions
    const realTopics = new Set(liveSessions.map((session) => session.topic))
    return [
      ...liveSessions,
      ...recentSessions.filter((session) => !realTopics.has(session.topic)),
    ]
  }, [liveSessions])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return sessions
    return sessions.filter((session) => (
      `${session.title} ${session.topic}`.toLowerCase().includes(normalized)
    ))
  }, [query, sessions])

  return (
    <div className="product-page history-page">
      <PageHeading
        title="Archive"
        description="Replay previous debates, compare scores, and find the logic patterns worth reusing."
        action={(
          <button className="product-button primary" type="button" onClick={() => navigateTo('/app/analyze?new=1')}>
            New analysis
          </button>
        )}
      />

      <div className="history-toolbar">
        <label>
          <Search size={18} />
          <input
            aria-label="Search debate history"
            placeholder="Search topics or sessions..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span><CalendarDays size={17} /> {syncing ? 'Syncing history...' : 'Last 30 days'}</span>
      </div>

      {filtered.length > 0 ? (
        <section className="product-panel history-table">
          <div className="history-table-head">
            <span>Session</span><span>Topic</span><span>Date</span><span>Growth</span><span>Score</span><span />
          </div>
          {filtered.map((session) => (
            <button key={session.id} type="button" onClick={() => navigateTo('/app/reports')}>
              <span><i><TrendingUp size={17} /></i><strong>{session.title}</strong></span>
              <span>{session.topic}</span>
              <span>{session.date}</span>
              <span className={session.trend.startsWith('-') ? 'negative' : 'positive'}>{session.trend}%</span>
              <strong className={session.score >= 80 ? 'positive' : 'contested'}>{session.score}%</strong>
              <ArrowRight size={16} />
            </button>
          ))}
        </section>
      ) : (
        <HistoryEmptyState onOpen={(title) => {
          setQuery('')
          navigateTo(`/app/analyze?topic=${encodeURIComponent(title)}`)
        }} />
      )}
    </div>
  )
}

function HistoryEmptyState({ onOpen }) {
  return (
    <section className="product-panel professional-empty">
      <TrendingUp size={28} />
      <h2>No debates match this search.</h2>
      <p>Explore a famous debate and use its structure as your next practice case.</p>
      <div>
        {famousDebates.map((debate) => (
          <button key={debate.title} type="button" onClick={() => onOpen(debate.title)}>
            <strong>{debate.title}</strong>
            <span>{debate.description}</span>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
    </section>
  )
}

export default HistoryPage
