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
import { PanelHeading, PageHeading } from './OverviewPage.jsx'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:8001')
function LiveDebatePage({ currentPath = '', token }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [speaker, setSpeaker] = useState('Speaker A')
  const [draft, setDraft] = useState('')
  const [customEntries, setCustomEntries] = useState([])
  const [liveAnalysis, setLiveAnalysis] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const intervalRef = useRef(null)
  const sessionIdRef = useRef(createSessionId('live'))
  const coachNoteRef = useRef(null)

  useEffect(() => {
    if (!running) return undefined
    intervalRef.current = window.setInterval(() => {
      setElapsed((current) => current + 1)
    }, 2200)
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
  const addStatement = async () => {
    const statement = draft.trim()
    if (!statement || analyzing) return
    const entryId = `statement-${Date.now()}`
    const currentSpeaker = speaker
    setCustomEntries((current) => [
      ...current,
      { id: entryId, speaker: currentSpeaker, text: statement, status: 'Analyzing now...' },
    ])
    setDraft('')
    setAnalyzing(true)

    try {
      const sessionId = sessionIdRef.current
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: `Live debate. ${currentSpeaker}: ${statement}`,
          session_id: sessionId,
          difficulty: 'hard',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.detail || 'Live analysis failed.')
      }
      setLiveAnalysis(data.reply || '')
      setCustomEntries((current) => current.map((entry) => (
        entry.id === entryId ? { ...entry, score: estimateStatementScore(statement, data.reply || ''), status: 'Analyzed' } : entry
      )))
      setSpeaker((current) => current === 'Speaker A' ? 'Speaker B' : 'Speaker A')
    } catch (error) {
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
    setSpeaker('Speaker A')
    sessionIdRef.current = createSessionId('live')
  }

  return (
    <div className="product-page live-page">
      <PageHeading
        title="Live debate"
        description="Analyze each speaker in real time, surface weaknesses, and prepare the next response."
        action={<span className={`live-session-state ${running ? 'running' : ''}`}><i /> {running ? 'Analysis live' : 'Ready'}</span>}
      />

      <section className="live-control-bar">
        <div><Timer size={18} /><span>Session time</span><strong>{formatTime(elapsed)}</strong></div>
        <div><Mic2 size={18} /><span>Current speaker</span><strong>{speaker}</strong></div>
        <div className="live-control-actions">
          <button className="product-button secondary" type="button" onClick={reset}><RotateCcw size={17} /> Reset</button>
          <button className="product-button primary" type="button" onClick={() => setRunning((current) => !current)}>
            {running ? <Pause size={17} /> : <Play size={17} />}
            {running ? 'Pause analysis' : 'Start live debate'}
          </button>
        </div>
      </section>

      <section className="live-grid">
        <article className="product-panel live-transcript">
          <PanelHeading title="Live transcript" meta={`${transcript.length} statements`} />
          <div className="live-statements">
            {transcript.length ? transcript.map((entry) => (
                <div key={entry.id}>
                  <span className={entry.speaker === 'Speaker A' ? 'speaker-a' : 'speaker-b'}>{entry.speaker}</span>
                  <p>{entry.text}</p>
                  <small>{entry.score ? `${entry.status} - ${entry.score}%` : entry.status}</small>
                </div>
              )) : (
                <div className="panel-empty-state compact">
                  <strong>No live statements yet.</strong>
                  <p>Start the timer and add a statement to create a real analyzed transcript.</p>
                </div>
              )}
          </div>
          <div className="live-entry">
            <label htmlFor="live-statement">{speaker} statement</label>
            <textarea
              id="live-statement"
              rows={3}
              placeholder="Type or dictate the next statement..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button className="product-button primary" disabled={analyzing} type="button" onClick={addStatement}>
              <Mic2 size={17} />
              {analyzing ? 'Analyzing...' : 'Add statement'}
            </button>
          </div>
        </article>

        <div className="live-analysis-stack">
          <article className="product-panel">
            <PanelHeading title="Real-time analysis" meta={customEntries.length ? 'From analyzed statements' : 'Waiting for statements'} />
            <div className="speaker-score-row">
              <span>Speaker A<strong>{speakerScores['Speaker A'] || 0}%</strong></span>
              <progress aria-label="Speaker A score" className="score-progress" max="100" value={speakerScores['Speaker A'] || 0} />
            </div>
            <div className="speaker-score-row beta">
              <span>Speaker B<strong>{speakerScores['Speaker B'] || 0}%</strong></span>
              <progress aria-label="Speaker B score" className="score-progress" max="100" value={speakerScores['Speaker B'] || 0} />
            </div>
            {customEntries.length ? (
              <div className="live-signal-list">
                {buildLiveSignals(customEntries).map((signal) => (
                  <div key={signal.title}>
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

function estimateStatementScore(statement, reply) {
  const text = `${statement} ${reply}`.toLowerCase()
  let score = 58 + Math.min(16, Math.floor(statement.length / 28))
  if (/because|therefore|leads to|results in/.test(text)) score += 7
  if (/study|report|data|research|source|\d/.test(text)) score += 6
  if (/however|counter|opposing|tradeoff/.test(text)) score += 5
  return Math.max(35, Math.min(95, score))
}

function computeSpeakerScores(entries) {
  return entries.reduce((scores, entry) => {
    if (!entry.score) return scores
    const current = scores[entry.speaker]
    scores[entry.speaker] = current ? Math.round((current + entry.score) / 2) : entry.score
    return scores
  }, {})
}

function buildLiveSignals(entries) {
  const latest = entries.at(-1)
  if (!latest) return []
  const text = latest.text.toLowerCase()
  return [
    {
      title: 'Latest statement analyzed',
      detail: `${latest.speaker} scored ${latest.score || 0}% on the newest saved statement.`,
      tone: 'green',
    },
    {
      title: /study|report|data|research|source|\d/.test(text) ? 'Evidence signal present' : 'Evidence gap',
      detail: /study|report|data|research|source|\d/.test(text)
        ? 'The statement includes a source, statistic, or evidence signal.'
        : 'The statement has no visible source, statistic, or evidence signal.',
      tone: /study|report|data|research|source|\d/.test(text) ? 'green' : 'amber',
    },
    {
      title: /however|counter|opposing|tradeoff/.test(text) ? 'Clash addressed' : 'Add clash',
      detail: /however|counter|opposing|tradeoff/.test(text)
        ? 'The statement engages a tradeoff or opposing view.'
        : 'A stronger live response should address the opponent directly.',
      tone: /however|counter|opposing|tradeoff/.test(text) ? 'green' : 'red',
    },
  ]
}

function summarizeLiveAnalysis(reply) {
  return reply.split(/\n{2,}|(?<=[.!?])\s+/).find(Boolean) || reply
}

export default LiveDebatePage
