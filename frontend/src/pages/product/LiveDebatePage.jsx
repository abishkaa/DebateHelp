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
const SCRIPT = [
  {
    speaker: 'Speaker A',
    text: 'AI regulation should require independent safety audits before high-risk systems are deployed.',
    score: 84,
    flag: 'Strong claim with a clear policy mechanism.',
  },
  {
    speaker: 'Speaker B',
    text: 'Mandatory audits could slow innovation and create barriers that only large companies can afford.',
    score: 79,
    flag: 'Relevant tradeoff. Needs evidence on compliance cost.',
  },
  {
    speaker: 'Speaker A',
    text: 'A tiered model can exempt low-risk systems while preserving accountability for consequential uses.',
    score: 88,
    flag: 'Effective rebuttal that narrows the proposal.',
  },
]

function LiveDebatePage({ currentPath = '', token }) {
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [visibleCount, setVisibleCount] = useState(1)
  const [speaker, setSpeaker] = useState('Speaker A')
  const [draft, setDraft] = useState('')
  const [customEntries, setCustomEntries] = useState([])
  const [liveAnalysis, setLiveAnalysis] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const intervalRef = useRef(null)
  const coachNoteRef = useRef(null)

  useEffect(() => {
    if (!running) return undefined
    intervalRef.current = window.setInterval(() => {
      setElapsed((current) => current + 1)
      setVisibleCount((current) => Math.min(SCRIPT.length, current + 1))
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
    () => [...SCRIPT.slice(0, visibleCount), ...customEntries],
    [customEntries, visibleCount],
  )
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
      let sessionId = localStorage.getItem('debate_live_session_id')
      if (!sessionId) {
        sessionId = crypto.randomUUID ? crypto.randomUUID() : `live-${Date.now()}`
        localStorage.setItem('debate_live_session_id', sessionId)
      }
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: `AI Regulation live debate. ${currentSpeaker}: ${statement}`,
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
        entry.id === entryId ? { ...entry, status: 'Analyzed' } : entry
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
    setVisibleCount(1)
    setDraft('')
    setCustomEntries([])
    setLiveAnalysis('')
    setSpeaker('Speaker A')
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
            {transcript.map((entry, index) => (
              <div key={entry.id || `${entry.speaker}-${index}`}>
                <span className={entry.speaker === 'Speaker A' ? 'speaker-a' : 'speaker-b'}>{entry.speaker}</span>
                <p>{entry.text}</p>
                <small>{entry.status || (index === transcript.length - 1 && running ? 'Analyzing now...' : 'Analyzed')}</small>
              </div>
            ))}
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
            <PanelHeading title="Real-time analysis" meta="Speaker A leading" />
            <div className="speaker-score-row">
              <span>Speaker A<strong>88%</strong></span>
              <progress aria-label="Speaker A score" className="score-progress" max="100" value="88" />
            </div>
            <div className="speaker-score-row beta">
              <span>Speaker B<strong>79%</strong></span>
              <progress aria-label="Speaker B score" className="score-progress" max="100" value="79" />
            </div>
            <div className="live-signal-list">
              <div><CheckCircle2 size={17} /><span><strong>Strong rebuttal</strong><small>Speaker A narrowed the policy effectively.</small></span></div>
              <div><AlertTriangle size={17} /><span><strong>Evidence gap</strong><small>Neither speaker has quantified audit cost.</small></span></div>
              <div><CircleStop size={17} /><span><strong>Weak assumption</strong><small>Innovation impact is asserted, not demonstrated.</small></span></div>
            </div>
          </article>

          <article className="product-panel live-counter">
            <PanelHeading title="Suggested counterargument" />
            <Sparkles size={20} />
            <div className="live-generated-analysis">
              {(liveAnalysis || 'A tiered audit framework can protect innovation by applying the strongest requirements only to systems with meaningful public risk.')
                .split('\n\n')
                .map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <small>{liveAnalysis ? 'Generated from the latest statement' : 'Confidence 86% - based on the current exchange'}</small>
          </article>

          <article className="product-panel live-coach-note" data-product-focus="coach" ref={coachNoteRef}>
            <PanelHeading title="Coach note" />
            <p>Ask Speaker B to define which compliance costs are uniquely caused by audits and provide a comparison against existing product certification regimes.</p>
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

export default LiveDebatePage
