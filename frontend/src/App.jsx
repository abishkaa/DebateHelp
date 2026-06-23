import { useCallback, useEffect, useMemo, useState } from 'react'

const API_BASE_URL = 'http://localhost:8000'

const TRACE_STEPS = [
  {
    label: 'Parsing input',
    detail: 'Claim text, debate mode, and session id normalized.',
  },
  {
    label: 'Checking prior context',
    detail: 'Persisted exchanges are loaded as working memory.',
  },
  {
    label: 'Evaluating options',
    detail: 'Agent selects whether to inspect facts or pressure-test logic.',
  },
  {
    label: 'Drafting response',
    detail: 'Counterpoint, uncertainty, and stronger framing are assembled.',
  },
]

const MODES = [
  { value: 'easy', label: 'Gentle', hint: 'constructive' },
  { value: 'normal', label: 'Balanced', hint: 'evidence-led' },
  { value: 'hard', label: 'Rigorous', hint: 'adversarial' },
]

const CAPABILITIES = [
  {
    tone: 'blue',
    text: 'Runs a multi-step reasoning loop, not a single model call.',
  },
  {
    tone: 'green',
    text: 'Persists and reasons over real session history.',
  },
  {
    tone: 'amber',
    text: 'Shows high-level process states instead of hiding work.',
  },
]

function createSessionId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toExchangeRecords(messages) {
  const records = []
  let current = null

  messages.forEach((message, index) => {
    if (message.role === 'user') {
      if (current) {
        records.push(current)
      }

      current = {
        id: `history-${message.created_at || index}`,
        user: message.content,
        agent: '',
        createdAt: message.created_at,
        status: 'complete',
      }
      return
    }

    if (!current) {
      records.push({
        id: `history-agent-${message.created_at || index}`,
        user: '',
        agent: message.content,
        createdAt: message.created_at,
        status: 'complete',
      })
      return
    }

    current.agent = message.content
    current.status = 'complete'
  })

  if (current) {
    records.push(current)
  }

  return records
}

function estimateStrength(reply, userArgument, difficulty) {
  const text = `${reply} ${userArgument}`.toLowerCase()
  const weakSignals = ['assumption', 'weak', 'uncertain', 'verify', 'unsupported', 'however']
  const strongSignals = ['stronger framing', 'evidence', 'because', 'distinguishes', 'counter']
  const weakCount = weakSignals.reduce((count, signal) => count + (text.includes(signal) ? 1 : 0), 0)
  const strongCount = strongSignals.reduce((count, signal) => count + (text.includes(signal) ? 1 : 0), 0)
  const difficultyPenalty = difficulty === 'hard' ? 8 : difficulty === 'easy' ? -4 : 0
  const lengthLift = Math.min(12, Math.floor(userArgument.length / 42))

  return clamp(58 + lengthLift + strongCount * 4 - weakCount * 5 - difficultyPenalty, 24, 92)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function getMetricStatus(value, loading, hasError) {
  if (hasError) {
    return { label: 'Weak', tone: 'red' }
  }

  if (loading) {
    return { label: 'Working', tone: 'amber' }
  }

  if (value >= 78) {
    return { label: 'Verified', tone: 'green' }
  }

  if (value >= 50) {
    return { label: 'Contested', tone: 'amber' }
  }

  return { label: 'Weak', tone: 'red' }
}

function formatTime(value) {
  if (!value) {
    return 'Not recorded'
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch {
    return 'Not recorded'
  }
}

function getApiLabel(status) {
  if (status === 'online') {
    return 'ONLINE'
  }

  if (status === 'offline') {
    return 'OFFLINE'
  }

  return 'CHECKING'
}

function App() {
  const [sessionId, setSessionId] = useState('')
  const [argument, setArgument] = useState('')
  const [difficulty, setDifficulty] = useState('normal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [pendingExchange, setPendingExchange] = useState(null)
  const [latestReply, setLatestReply] = useState('')
  const [traceIndex, setTraceIndex] = useState(-1)
  const [metric, setMetric] = useState(54)
  const [lastLatency, setLastLatency] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking')

  const loadHistory = useCallback(async (sid) => {
    try {
      const res = await fetch(`${API_BASE_URL}/history/${sid}`)
      if (!res.ok) {
        return
      }

      const data = await res.json()
      setHistory(Array.isArray(data.messages) ? data.messages : [])
    } catch (err) {
      console.warn('Unable to load history:', err)
    }
  }, [])

  useEffect(() => {
    const storedSessionId = localStorage.getItem('debate_session_id')
    const nextSessionId = storedSessionId || createSessionId()

    localStorage.setItem('debate_session_id', nextSessionId)
    setSessionId(nextSessionId)
    loadHistory(nextSessionId)
  }, [loadHistory])

  useEffect(() => {
    let active = true

    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE_URL}/health`)
        if (active) {
          setApiStatus(res.ok ? 'online' : 'offline')
        }
      } catch {
        if (active) {
          setApiStatus('offline')
        }
      }
    }

    checkHealth()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!loading) {
      return undefined
    }

    setTraceIndex(0)
    const timer = window.setInterval(() => {
      setTraceIndex((current) => clamp(current + 1, 0, TRACE_STEPS.length - 1))
    }, 760)

    return () => window.clearInterval(timer)
  }, [loading])

  const exchangeRecords = useMemo(() => {
    const records = toExchangeRecords(history)

    if (pendingExchange) {
      return [...records, pendingExchange]
    }

    return records
  }, [history, pendingExchange])

  const latestUserArgument = pendingExchange?.user
    || [...history].reverse().find((message) => message.role === 'user')?.content
    || argument

  const targetMetric = useMemo(() => {
    if (error) {
      return 28
    }

    if (loading) {
      return clamp(48 + Math.max(traceIndex, 0) * 9 + Math.min(argument.length / 60, 8), 42, 86)
    }

    if (latestReply) {
      return estimateStrength(latestReply, latestUserArgument, difficulty)
    }

    if (argument.trim()) {
      return clamp(40 + Math.floor(argument.trim().length / 22), 42, 72)
    }

    if (exchangeRecords.length > 0) {
      return 64
    }

    return 54
  }, [argument, difficulty, error, exchangeRecords.length, latestReply, latestUserArgument, loading, traceIndex])

  useEffect(() => {
    setMetric(targetMetric)
  }, [targetMetric])

  const metricStatus = getMetricStatus(metric, loading, Boolean(error))

  const stats = useMemo(() => {
    const completedExchanges = exchangeRecords.filter((record) => record.status === 'complete').length
    return [
      { label: 'EXCHANGES', value: String(completedExchanges).padStart(2, '0') },
      { label: 'MESSAGES', value: String(history.length).padStart(2, '0') },
      { label: 'TRACE STEPS', value: String(TRACE_STEPS.length).padStart(2, '0') },
      { label: 'LATENCY', value: lastLatency ? `${lastLatency}ms` : 'N/A' },
    ]
  }, [exchangeRecords, history.length, lastLatency])

  const resetSession = useCallback(() => {
    const nextSessionId = createSessionId()
    localStorage.setItem('debate_session_id', nextSessionId)
    setSessionId(nextSessionId)
    setHistory([])
    setPendingExchange(null)
    setLatestReply('')
    setArgument('')
    setError(null)
    setTraceIndex(-1)
    setLastLatency(null)
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()

    const submittedArgument = argument.trim()
    if (!submittedArgument) {
      setError('Enter an argument before running the agent.')
      return
    }

    if (!sessionId) {
      setError('Session is still initializing. Try again in a moment.')
      return
    }

    const optimisticRecord = {
      id: `pending-${Date.now()}`,
      user: submittedArgument,
      agent: '',
      createdAt: new Date().toISOString(),
      status: 'running',
    }

    setLoading(true)
    setError(null)
    setLatestReply('')
    setPendingExchange(optimisticRecord)

    const startedAt = performance.now()

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: submittedArgument,
          session_id: sessionId,
          difficulty,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || `Server error: ${res.status}`)
      }

      const data = await res.json()
      const reply = data.reply || ''
      const finishedAt = Math.round(performance.now() - startedAt)

      setLatestReply(reply)
      setLastLatency(finishedAt)
      setHistory((current) => [
        ...current,
        {
          role: 'user',
          content: submittedArgument,
          created_at: optimisticRecord.createdAt,
        },
        {
          role: 'assistant',
          content: reply,
          created_at: new Date().toISOString(),
        },
      ])
      setArgument('')
      setPendingExchange(null)
      setTraceIndex(TRACE_STEPS.length)
    } catch (err) {
      const message = err.message || 'Failed to connect to the Debate Coach backend.'
      setError(message)
      setPendingExchange({
        ...optimisticRecord,
        agent: message,
        status: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="agent-shell">
      <Sidebar
        apiStatus={apiStatus}
        capabilities={CAPABILITIES}
        difficulty={difficulty}
        metric={metric}
        metricStatus={metricStatus}
        onDifficultyChange={setDifficulty}
        onResetSession={resetSession}
        sessionId={sessionId}
        stats={stats}
      />

      <main className="workspace" aria-label="Debate agent workspace">
        <section className="workspace-top">
          <div>
            <p className="eyebrow">DEBATE AGENT CONSOLE</p>
            <h1>Argument analysis record</h1>
          </div>
          <div className={`api-pill ${apiStatus}`}>
            <span aria-hidden="true" />
            {getApiLabel(apiStatus)}
          </div>
        </section>

        <section className="run-grid">
          <form className="composer-panel" onSubmit={handleSubmit}>
            <div className="field-head">
              <label htmlFor="argument">User argument</label>
              <span>{argument.trim().length} chars</span>
            </div>
            <textarea
              id="argument"
              value={argument}
              onChange={(event) => setArgument(event.target.value)}
              placeholder="Paste the claim or debate case you want pressure-tested."
              rows={7}
            />
            <div className="composer-actions">
              <button type="button" className="secondary-action" onClick={resetSession}>
                New session
              </button>
              <button type="submit" className="primary-action" disabled={loading || !sessionId}>
                {loading ? 'Agent running' : 'Run analysis'}
              </button>
            </div>
          </form>

          <TracePanel
            hasError={Boolean(error)}
            isRunning={loading}
            traceIndex={traceIndex}
          />
        </section>

        <section className="transcript-panel" aria-live="polite">
          <div className="section-head">
            <div>
              <p className="eyebrow">STRUCTURED TRANSCRIPT</p>
              <h2>No bubbles. Just the record.</h2>
            </div>
            <span>{exchangeRecords.length || 0} exchanges</span>
          </div>

          <div className="exchange-list">
            {exchangeRecords.length > 0 ? (
              exchangeRecords.map((record, index) => (
                <ExchangeRecord
                  key={record.id}
                  index={index + 1}
                  record={record}
                  traceIndex={traceIndex}
                />
              ))
            ) : (
              <ExchangeRecord
                index={1}
                record={{
                  id: 'empty',
                  user: 'Awaiting a claim to analyze.',
                  agent: 'The next run will appear here as a structured left/right exchange.',
                  status: 'idle',
                }}
                traceIndex={traceIndex}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

function Sidebar({
  apiStatus,
  capabilities,
  difficulty,
  metric,
  metricStatus,
  onDifficultyChange,
  onResetSession,
  sessionId,
  stats,
}) {
  return (
    <aside className="sidebar" aria-label="Agent control panel">
      <div className="brand-row">
        <div className="brand-mark">DA</div>
        <div>
          <p>Debate Agent</p>
          <span>reasoning workbench</span>
        </div>
      </div>

      <div className="control-panel">
        <label htmlFor="mode-select">Mode selector</label>
        <select
          id="mode-select"
          value={difficulty}
          onChange={(event) => onDifficultyChange(event.target.value)}
        >
          {MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.label} / {mode.hint}
            </option>
          ))}
        </select>
      </div>

      <Gauge value={metric} status={metricStatus} />

      <div className="stats-panel">
        <div className="sidebar-title">Live session stats</div>
        <div className="stats-grid">
          {stats.map((stat) => (
            <div className="stat" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>
        <div className="session-line">
          <span>SESSION</span>
          <strong>{sessionId ? sessionId.slice(0, 8) : 'pending'}</strong>
        </div>
        <div className={`session-line api ${apiStatus}`}>
          <span>API</span>
          <strong>{getApiLabel(apiStatus)}</strong>
        </div>
      </div>

      <div className="capability-panel">
        <div className="sidebar-title">Why this is not just a chatbot</div>
        <ul>
          {capabilities.map((item) => (
            <li key={item.text}>
              <span className={`capability-dot ${item.tone}`} aria-hidden="true" />
              {item.text}
            </li>
          ))}
        </ul>
      </div>

      <button type="button" className="sidebar-action" onClick={onResetSession}>
        Reset workspace
      </button>
    </aside>
  )
}

function Gauge({ value, status }) {
  const needleAngle = -180 + (value / 100) * 180

  return (
    <div className={`gauge-card ${status.tone}`}>
      <div className="sidebar-title">Argument strength</div>
      <svg className="gauge" viewBox="0 0 180 112" role="img" aria-label={`Argument strength ${value} percent`}>
        <path
          className="gauge-track"
          d="M22 88 A68 68 0 0 1 158 88"
          pathLength="100"
        />
        <path
          className="gauge-progress"
          d="M22 88 A68 68 0 0 1 158 88"
          pathLength="100"
          style={{ strokeDasharray: `${value} 100` }}
        />
        <g className="gauge-needle" style={{ transform: `rotate(${needleAngle}deg)` }}>
          <line x1="90" y1="88" x2="150" y2="88" />
          <circle cx="150" cy="88" r="4.5" />
        </g>
        <circle className="gauge-hub" cx="90" cy="88" r="4" />
      </svg>
      <div className="gauge-readout">
        <strong>{Math.round(value)}</strong>
        <span>{status.label}</span>
      </div>
    </div>
  )
}

function TracePanel({ hasError, isRunning, traceIndex }) {
  return (
    <aside className="trace-panel" aria-label="Live reasoning trace">
      <div className="section-head compact">
        <div>
          <p className="eyebrow">LIVE REASONING TRACE</p>
          <h2>{isRunning ? 'Agent is working' : 'Process monitor'}</h2>
        </div>
      </div>
      <div className="trace-list">
        {TRACE_STEPS.map((step, index) => {
          const status = getTraceStatus(index, traceIndex, isRunning, hasError)
          return (
            <div className={`trace-step ${status}`} key={step.label}>
              <TraceMarker status={status} />
              <div>
                <strong>{step.label}</strong>
                <span>{step.detail}</span>
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function getTraceStatus(index, traceIndex, isRunning, hasError) {
  if (hasError && index === Math.max(traceIndex, 0)) {
    return 'error'
  }

  if (traceIndex >= TRACE_STEPS.length) {
    return 'done'
  }

  if (index < traceIndex) {
    return 'done'
  }

  if (isRunning && index === traceIndex) {
    return 'active'
  }

  return 'pending'
}

function TraceMarker({ status }) {
  if (status === 'done') {
    return (
      <span className="trace-marker done" aria-label="done">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.2 8.2 6.6 11.6 12.9 4.4" />
        </svg>
      </span>
    )
  }

  if (status === 'active') {
    return (
      <span className="trace-marker active" aria-label="active">
        <span aria-hidden="true" />
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span className="trace-marker error" aria-label="error">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4.4 4.4 11.6 11.6M11.6 4.4 4.4 11.6" />
        </svg>
      </span>
    )
  }

  return <span className="trace-marker pending" aria-label="pending" />
}

function ExchangeRecord({ index, record, traceIndex }) {
  const statusLabel = record.status === 'running'
    ? 'RUNNING'
    : record.status === 'error'
      ? 'ERROR'
      : record.status === 'idle'
        ? 'IDLE'
        : 'COMPLETE'

  return (
    <article className={`exchange-record ${record.status}`}>
      <div className="exchange-index">
        {String(index).padStart(2, '0')}
      </div>

      <div className="exchange-cell user-cell">
        <div className="cell-head">
          <span>USER INPUT</span>
          <time>{formatTime(record.createdAt)}</time>
        </div>
        <p>{record.user || 'No user input captured for this record.'}</p>
      </div>

      <div className="exchange-divider" aria-hidden="true" />

      <div className="exchange-cell agent-cell">
        <div className="cell-head">
          <span>AGENT OUTPUT</span>
          <strong>{statusLabel}</strong>
        </div>
        {record.status === 'running' ? (
          <InlineTrace traceIndex={traceIndex} />
        ) : (
          <p>{record.agent || 'Awaiting response from the agent.'}</p>
        )}
      </div>
    </article>
  )
}

function InlineTrace({ traceIndex }) {
  return (
    <div className="inline-trace">
      {TRACE_STEPS.map((step, index) => {
        const active = index === traceIndex
        const done = index < traceIndex

        return (
          <div className={`inline-step ${active ? 'active' : ''} ${done ? 'done' : ''}`} key={step.label}>
            <TraceMarker status={active ? 'active' : done ? 'done' : 'pending'} />
            <span>{step.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default App
