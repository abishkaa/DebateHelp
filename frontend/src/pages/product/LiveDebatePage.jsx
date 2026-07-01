import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleStop,
  Mic2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Timer,
} from 'lucide-react'
import { buildApiUrl, networkErrorMessage } from '../../services/apiConfig.js'
import { PanelHeading, PageHeading } from './OverviewPage.jsx'

function LiveDebatePage({ currentPath = '', currentUser, token }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [speakerKey, setSpeakerKey] = useState('user')
  const [draft, setDraft] = useState('')
  const [customEntries, setCustomEntries] = useState([])
  const [liveAnalysis, setLiveAnalysis] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [sessionStartedAt, setSessionStartedAt] = useState('')
  const intervalRef = useRef(null)
  const sessionIdRef = useRef(createSessionId('live'))
  const coachNoteRef = useRef(null)
  const currentUserName = getUserDisplayName(currentUser)
  const speakerOptions = useMemo(() => buildSpeakerOptions(currentUserName), [currentUserName])
  const activeSpeaker = speakerOptions.find((option) => option.key === speakerKey) || speakerOptions[0]

  useEffect(() => {
    if (!running) return undefined
    intervalRef.current = window.setInterval(() => {
      setElapsed((current) => current + 1)
    }, 1000)
    return () => window.clearInterval(intervalRef.current)
  }, [running])

  useEffect(() => {
    if (!currentPath.includes('focus=coach')) return
    const frameId = window.requestAnimationFrame(() => {
      coachNoteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [currentPath])

  const transcript = useMemo(
    () => customEntries,
    [customEntries],
  )
  const speakerScores = useMemo(() => computeSpeakerScores(customEntries), [customEntries])
  const startLiveDebate = () => {
    setError('')
    setRunning((current) => {
      const next = !current
      if (next && !sessionStartedAt) {
        setSessionStartedAt(new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date()))
      }
      return next
    })
  }

  const addStatement = async () => {
    const statement = draft.trim()
    if (!running) {
      setError('Start the live debate before adding a statement.')
      return
    }
    if (!statement || analyzing) return
    const entryId = `statement-${Date.now()}`
    const currentSpeaker = activeSpeaker
    setError('')
    setCustomEntries((current) => [
      ...current,
      {
        id: entryId,
        speaker: currentSpeaker.label,
        speakerKey: currentSpeaker.key,
        text: statement,
        status: 'Analyzing now...',
      },
    ])
    setDraft('')
    setAnalyzing(true)

    try {
      const sessionId = sessionIdRef.current
      let response
      try {
        response = await fetch(buildApiUrl('/chat'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            message: [
              'Live debate session.',
              `Speaker: ${currentSpeaker.label}.`,
              `Speaker role: ${currentSpeaker.role}.`,
              `Statement: ${statement}`,
            ].join(' '),
            session_id: sessionId,
            difficulty: 'hard',
          }),
        })
      } catch {
        throw new Error(networkErrorMessage('live analysis service'))
      }
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const fallback = response.status >= 500
          ? networkErrorMessage('live analysis service')
          : 'Live analysis failed.'
        throw new Error(data.detail || fallback)
      }
      const computedScore = getComputedScore(data.analysis)
      if (computedScore === null) {
        throw new Error('Live analysis returned without a computed score. Try again in a moment.')
      }
      setLiveAnalysis(data.reply || '')
      setCustomEntries((current) => current.map((entry) => (
        entry.id === entryId
          ? { ...entry, analysis: data.analysis || null, score: computedScore, status: 'Analyzed' }
          : entry
      )))
      setSpeakerKey((current) => current === 'user' ? 'opponent' : 'user')
    } catch (error) {
      setError(error.message || 'Analysis unavailable')
      setCustomEntries((current) => current.map((entry) => (
        entry.id === entryId ? { ...entry, status: error.message || 'Analysis unavailable' } : entry
      )))
    } finally {
      setAnalyzing(false)
    }
  }

  const reset = () => {
    setRunning(false)
    setElapsed(0)
    setDraft('')
    setCustomEntries([])
    setLiveAnalysis('')
    setSpeakerKey('user')
    setError('')
    setSessionStartedAt('')
    sessionIdRef.current = createSessionId('live')
  }

  return (
    <div className="product-page live-page">
      <PageHeading
        title="Live debate"
        description="Analyze each speaker in real time, surface weaknesses, and prepare the next response."
        action={<span className={`live-session-state ${running ? 'running' : ''}`}><i /> {running ? 'Analysis live' : sessionStartedAt ? 'Paused' : 'Ready'}</span>}
      />

      <section className="live-control-bar">
        <div><Timer size={18} /><span>Session time</span><strong>{formatTime(elapsed)}</strong></div>
        <div><Mic2 size={18} /><span>Current speaker</span><strong>{activeSpeaker.label}</strong></div>
        <div className="live-control-actions">
          <button className="product-button secondary" type="button" onClick={reset}><RotateCcw size={17} /> Reset</button>
          <button className="product-button primary" type="button" onClick={startLiveDebate}>
            {running ? <Pause size={17} /> : <Play size={17} />}
            {running ? 'Pause analysis' : sessionStartedAt ? 'Resume live debate' : 'Start live debate'}
          </button>
        </div>
      </section>

      <section className="live-grid">
        <article className="product-panel live-transcript">
          <PanelHeading title="Live transcript" meta={`${transcript.length} statements`} />
          <div className="live-statements">
            {transcript.length ? transcript.map((entry) => (
                <div key={entry.id}>
                  <span className={entry.speakerKey === 'user' ? 'speaker-a' : 'speaker-b'}>{entry.speaker}</span>
                  <p>{entry.text}</p>
                  <small>{typeof entry.score === 'number' ? `${entry.status} - ${entry.score}%` : entry.status}</small>
                </div>
              )) : (
                <div className="panel-empty-state compact">
                  <strong>No live statements yet.</strong>
                  <p>Start the timer and add a statement to create a real analyzed transcript.</p>
                </div>
              )}
          </div>
          <div className="live-entry">
            <div className="speaker-toggle" role="group" aria-label="Select current speaker">
              {speakerOptions.map((option) => (
                <button
                  className={option.key === speakerKey ? 'active' : ''}
                  disabled={analyzing}
                  key={option.key}
                  type="button"
                  onClick={() => setSpeakerKey(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label htmlFor="live-statement">{activeSpeaker.label} statement</label>
            <textarea
              id="live-statement"
              rows={3}
              placeholder={running ? 'Type or dictate the next statement...' : 'Start the live debate, then add the first statement...'}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            {error && <div className="live-error">{error}</div>}
            <button className="product-button primary" disabled={analyzing || !running || !draft.trim()} type="button" onClick={addStatement}>
              <Mic2 size={17} />
              {analyzing ? 'Analyzing...' : running ? 'Add statement' : 'Start session first'}
            </button>
            {sessionStartedAt && <small className="live-session-meta">Session {sessionIdRef.current} started at {sessionStartedAt}</small>}
          </div>
        </article>

        <div className="live-analysis-stack">
          <article className="product-panel">
            <PanelHeading title="Real-time analysis" meta={customEntries.length ? 'From analyzed statements' : 'Waiting for statements'} />
            <div className="speaker-score-row">
              <span>{speakerOptions[0].label}<strong>{speakerScores.user || 0}%</strong></span>
              <progress aria-label={`${speakerOptions[0].label} score`} className="score-progress" max="100" value={speakerScores.user || 0} />
            </div>
            <div className="speaker-score-row beta">
              <span>{speakerOptions[1].label}<strong>{speakerScores.opponent || 0}%</strong></span>
              <progress aria-label={`${speakerOptions[1].label} score`} className="score-progress" max="100" value={speakerScores.opponent || 0} />
            </div>
            {customEntries.length ? (
              <div className="live-signal-list">
                {buildLiveSignals(customEntries).map((signal) => (
                  <div className={signal.tone} key={signal.title}>
                    {signal.tone === 'green' ? <CheckCircle2 size={17} /> : signal.tone === 'amber' ? <AlertTriangle size={17} /> : <CircleStop size={17} />}
                    <span><strong>{signal.title}</strong><small>{signal.detail}</small></span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel-empty-state compact">
                <strong>No score data yet.</strong>
                <p>Speaker scores are calculated from real analyzed statements only.</p>
              </div>
            )}
          </article>

          <article className="product-panel live-counter">
            <PanelHeading title="Suggested counterargument" />
            <Sparkles size={20} />
            <div className="live-generated-analysis">
              {(liveAnalysis || 'Add a statement to generate a real counterargument from DebateHelp.')
                .split('\n\n')
                .map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <small>{liveAnalysis ? 'Generated from the latest statement' : 'Waiting for real debate input'}</small>
          </article>

          <article className="product-panel live-coach-note" data-product-focus="coach" ref={coachNoteRef}>
            <PanelHeading title="Coach note" />
            <p>{liveAnalysis ? summarizeLiveAnalysis(liveAnalysis) : 'Coach notes appear after DebateHelp analyzes a live statement.'}</p>
          </article>
        </div>
      </section>
    </div>
  )
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function createSessionId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`
  return `${prefix}-${Date.now()}`
}

function getUserDisplayName(currentUser) {
  return currentUser?.full_name || currentUser?.email || 'You'
}

function buildSpeakerOptions(currentUserName) {
  return [
    { key: 'user', label: currentUserName, role: 'Signed-in DebateHelp user' },
    { key: 'opponent', label: 'Opponent', role: 'Opponent or second real speaker' },
  ]
}

function toScore(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(100, Math.round(number)))
}

function getComputedScore(analysis) {
  if (!analysis?.scores) return null
  const number = Number(analysis.scores.strength)
  if (!Number.isFinite(number)) return null
  return toScore(number)
}

function computeSpeakerScores(entries) {
  return entries.reduce((scores, entry) => {
    if (typeof entry.score !== 'number') return scores
    const speaker = entry.speakerKey || 'user'
    const current = scores[speaker]
    scores[speaker] = current ? Math.round((current + entry.score) / 2) : entry.score
    return scores
  }, {})
}

function buildLiveSignals(entries) {
  const latest = entries.at(-1)
  if (!latest) return []
  const analysis = latest.analysis || {}
  const sources = Array.isArray(analysis.sources) ? analysis.sources : []
  const fallacies = Array.isArray(analysis.fallacies) ? analysis.fallacies : []
  const recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : []
  return [
    {
      title: 'Latest statement analyzed',
      detail: `${latest.speaker} scored ${latest.score || 0}% on the newest saved statement${analysis.method ? ` using ${analysis.method}` : ''}.`,
      tone: 'green',
    },
    {
      title: sources.length ? 'Evidence signals found' : 'Evidence gap',
      detail: sources.length
        ? `${sources.length} source/statistic/citation signal${sources.length === 1 ? '' : 's'} detected by the backend analyzer.`
        : 'The backend analyzer found no source, statistic, or citation signal in the latest statement.',
      tone: sources.length ? 'green' : 'amber',
    },
    {
      title: fallacies.length ? 'Reasoning risk flagged' : 'No major fallacy flag',
      detail: fallacies.length
        ? `${fallacies[0].name || 'Reasoning risk'}: ${fallacies[0].detail || 'Review this reasoning step.'}`
        : 'No major fallacy pattern was detected for the latest statement.',
      tone: fallacies.length ? 'red' : 'green',
    },
    {
      title: 'Next coaching move',
      detail: recommendations[0] || 'Keep adding live statements to build a stronger session report.',
      tone: recommendations.length ? 'amber' : 'green',
    },
  ]
}

function summarizeLiveAnalysis(reply) {
  return reply.split(/\n{2,}|(?<=[.!?])\s+/).find(Boolean) || reply
}

export default LiveDebatePage
