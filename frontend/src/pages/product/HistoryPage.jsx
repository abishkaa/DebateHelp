import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Search, TrendingUp } from 'lucide-react'
import { productApi } from '../../services/productApi.js'
import { PageHeading } from './OverviewPage.jsx'

function HistoryPage({ currentPath = '', navigateTo, token }) {
  const [query, setQuery] = useState('')
  const [liveSessions, setLiveSessions] = useState([])
  const [syncing, setSyncing] = useState(Boolean(token))
  const selectedSessionId = useMemo(() => {
    const queryString = currentPath.split('?')[1] || ''
    return new URLSearchParams(queryString).get('session') || ''
  }, [currentPath])

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

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return liveSessions
    return liveSessions.filter((session) => (
      `${session.title} ${session.topic}`.toLowerCase().includes(normalized)
    ))
  }, [query, liveSessions])

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
            <button
              className={selectedSessionId === session.id ? 'selected' : ''}
              key={session.id}
              type="button"
              onClick={() => navigateTo(`/app/reports?session=${encodeURIComponent(session.id)}`)}
            >
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
        <HistoryEmptyState
          hasQuery={Boolean(query.trim())}
          query={query}
          onStart={(topic = '') => {
            setQuery('')
            navigateTo(topic ? `/app/analyze?topic=${encodeURIComponent(topic)}` : '/app/analyze?new=1')
          }}
        />
      )}
    </div>
  )
}

function HistoryEmptyState({ hasQuery, onStart, query }) {
  const trimmedQuery = query.trim()
  return (
    <section className="product-panel professional-empty">
      <TrendingUp size={28} />
      <h2>{hasQuery ? 'No real sessions match this search.' : 'No real sessions yet.'}</h2>
      <p>
        {hasQuery
          ? 'Try a different search term, or start a new analysis.'
          : 'Analyze an argument to create your first saved archive entry. DebateHelp will only archive real sessions saved to your account.'}
      </p>
      <div>
        {hasQuery && trimmedQuery ? (
          <button type="button" onClick={() => onStart(trimmedQuery)}>
            <strong>Analyze “{trimmedQuery}”</strong>
            <span>Use your search as the next real practice topic.</span>
            <ArrowRight size={16} />
          </button>
        ) : null}
        <button type="button" onClick={() => onStart()}>
          <strong>Start a blank analysis</strong>
          <span>Create the first real saved session for this account.</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  )
}

export default HistoryPage
