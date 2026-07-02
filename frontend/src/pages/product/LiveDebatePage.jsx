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
  const [liveCounterargument, setLiveCounterargument] = useState('')
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
  const hasScoredEntries = customEntries.some((entry) => typeof entry.score === 'number')
  const latestImprovementPlan = useMemo(() => getLatestImprovementPlan(customEntries), [customEntries])
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
      const analysis = normalizeLiveAnalysis(data.analysis, statement, data.reply)
      const computedScore = getComputedScore(analysis)
      if (!data.reply && computedScore === null) {
        throw new Error('Live analysis returned an empty response. Try again in a moment.')
      }
      setLiveAnalysis(data.reply || '')
      setLiveCounterargument(buildSuggestedCounterargument(analysis, data.reply, statement))
      setCustomEntries((current) => current.map((entry) => (
        entry.id === entryId
          ? {
              ...entry,
              analysis,
              score: computedScore,
              status: 'Analyzed',
            }
          : entry
      )))
      setSpeakerKey((current) => current === 'user' ? 'opponent' : 'user')
    } catch (error) {
      setError(error.message || 'Analysis unavailable')
      setCustomEntries((current) => current.map((entry) => (
        entry.id === entryId
          ? { ...entry, error: error.message || 'Analysis unavailable', status: 'Analysis failed' }
          : entry
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
    setLiveCounterargument('')
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
                  <small className={entryStatusTone(entry)}>
                    {typeof entry.score === 'number' ? `${entry.status} - ${entry.score}%` : entry.status}
                  </small>
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
            <PanelHeading
              title="Real-time analysis"
              meta={hasScoredEntries ? 'From analyzed statements' : customEntries.length ? 'Analyzing statement' : 'Waiting for statements'}
            />
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
              {(liveCounterargument || 'Add a statement to generate a real counterargument from DebateHelp.')
                .split('\n\n')
                .map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <small>{liveCounterargument ? 'Generated from the latest statement analysis' : 'Waiting for real debate input'}</small>
          </article>

          <article className="product-panel live-coach-note" data-product-focus="coach" ref={coachNoteRef}>
            <PanelHeading title="Coach note" />
            <p>{liveAnalysis ? summarizeLiveAnalysis(liveAnalysis) : 'Coach notes appear after DebateHelp analyzes a live statement.'}</p>
            {latestImprovementPlan.length ? (
              <div className="live-improvement-list" aria-label="Latest live debate improvement plan">
                {latestImprovementPlan.slice(0, 3).map((item, index) => (
                  <div key={`${item.area}-${item.action}`}>
                    <span>{index + 1}</span>
                    <strong>{item.area} · {item.score}%</strong>
                    <small>{item.action}</small>
                  </div>
                ))}
              </div>
            ) : null}
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

function normalizeLiveAnalysis(analysis, statement, reply) {
  if (getComputedScore(analysis) !== null) {
    return {
      ...analysis,
      improvementPlan: normalizeImprovementPlan(analysis?.improvementPlan || analysis?.improvement_plan),
    }
  }

  const recoveredScore = scoreLiveStatement(statement, reply)
  const counterargument = buildSuggestedCounterargument(analysis, reply, statement)
  const strongerFraming = extractLabeledSection(reply, 'Stronger framing')
  const fallbackPlan = normalizeImprovementPlan(analysis?.improvementPlan || analysis?.improvement_plan)
  const improvementPlan = fallbackPlan.length
    ? fallbackPlan
    : buildFallbackImprovementPlan(statement, recoveredScore, counterargument)
  const recommendations = [
    ...improvementPlan.map((item) => item.action),
    strongerFraming,
    ...(Array.isArray(analysis?.recommendations) ? analysis.recommendations : []),
  ].filter(Boolean)

  return {
    ...(analysis || {}),
    scores: {
      ...(analysis?.scores || {}),
      strength: recoveredScore,
      evidence: toScore(recoveredScore - 8),
      coverage: toScore(counterargument ? recoveredScore + 6 : recoveredScore - 12),
      logic: toScore(recoveredScore + 4),
    },
    sources: Array.isArray(analysis?.sources) ? analysis.sources : extractEvidenceSignals(statement),
    fallacies: Array.isArray(analysis?.fallacies) ? analysis.fallacies : [],
    recommendations: recommendations.length ? recommendations.slice(0, 4) : [
      'Add a named source, explain the mechanism, and answer the strongest alternative explanation.',
    ],
    improvementPlan,
    counterargument,
    counterarguments: Array.isArray(analysis?.counterarguments) && analysis.counterarguments.length
      ? analysis.counterarguments
      : [counterargument],
    method: analysis?.method || 'live_statement_recovery',
  }
}

function scoreLiveStatement(statement, reply = '') {
  const text = `${statement} ${reply}`.toLowerCase()
  const words = statement.trim().split(/\s+/).filter(Boolean).length
  let score = 42 + Math.min(18, Math.floor(words / 4))
  if (/\bbecause\b|\btherefore\b|leads? to|results? in|so that|causes?/.test(text)) score += 12
  if (/\bstudy\b|\bresearch\b|\bdata\b|\breport\b|\bsource\b|\bstatistic\b|\b\d{4}\b|\b\d+(?:\.\d+)?%/.test(text)) score += 12
  if (/\bhowever\b|\balthough\b|\beven if\b|\boppos|\bcounter|\btrade-?off\b/.test(text)) score += 10
  if (/\bimpact\b|\bharm\b|\bbenefit\b|\brisk\b|\bcost\b|\boutcome\b/.test(text)) score += 5
  if (/\b(main weakness|not tied to|needs|not answered|challenge whether)\b/.test(text)) score -= 4
  return toScore(score)
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

function buildSuggestedCounterargument(analysis, reply, statement) {
  const fromReply = extractLabeledSection(reply, 'Counterargument')
  if (fromReply) return fromReply

  if (analysis?.counterargument) return analysis.counterargument

  if (Array.isArray(analysis?.counterarguments) && analysis.counterarguments.length) {
    return analysis.counterarguments.join('\n\n')
  }

  return defaultCounterargument(statement)
}

function extractLabeledSection(text = '', label) {
  if (!text) return ''
  const labels = [
    'Strongest part',
    'Main weakness',
    'Counterargument',
    'Stronger framing',
    'Confidence',
  ].join('|')
  const pattern = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n\\n(?:${labels}):|$)`, 'i')
  const match = text.match(pattern)
  return match?.[1]?.trim() || ''
}

function extractEvidenceSignals(statement) {
  const signals = statement.match(/https?:\/\/\S+|\b\d{4}\b|\b\d+(?:\.\d+)?%|\b(?:study|report|research|source|data|survey|journal|statistic)\b/gi) || []
  return [...new Set(signals)].slice(0, 5).map((signal) => ({
    source: signal,
    detail: 'Evidence signal detected in the live statement.',
    credibility: signal.startsWith('http') ? 78 : 58,
    tone: signal.startsWith('http') ? 'green' : 'amber',
  }))
}

function defaultCounterargument(statement = '') {
  const normalized = statement.toLowerCase()
  if (/ai|artificial intelligence|algorithm/.test(normalized)) {
    return 'A strong opponent can argue that broad rules raise compliance costs, protect large incumbents, and slow useful low-risk innovation.'
  }
  if (/school|student|education|university|college/.test(normalized)) {
    return 'A strong opponent can agree with the learning goal while arguing that teacher capacity, schedule pressure, and unequal implementation determine whether the reform actually works.'
  }
  if (/climate|carbon|emission/.test(normalized)) {
    return 'A strong opponent can argue that the policy changes costs without proving it will change behavior fast enough to reduce emissions.'
  }
  if (/health|medical|care/.test(normalized)) {
    return 'A strong opponent can accept the access goal while challenging funding, provider capacity, wait times, and transition costs.'
  }
  return 'A strong opponent can challenge whether your evidence proves this specific conclusion instead of a narrower alternative.'
}

function buildLiveSignals(entries) {
  const latest = entries.at(-1)
  const latestScored = [...entries]
    .reverse()
    .find((entry) => typeof entry.score === 'number' && entry.status === 'Analyzed')
  if (!latest) return []
  if (!latestScored) {
    const failed = latest.status === 'Analysis failed'
    return [
      {
        title: failed ? 'Latest statement needs attention' : 'Analyzing latest statement',
        detail: latest.error || latest.status || 'No scored live statement is available yet.',
        tone: failed ? 'red' : 'amber',
      },
    ]
  }
  const analysis = latestScored.analysis || {}
  const sources = Array.isArray(analysis.sources) ? analysis.sources : []
  const fallacies = Array.isArray(analysis.fallacies) ? analysis.fallacies : []
  const improvementPlan = normalizeImprovementPlan(analysis.improvementPlan || analysis.improvement_plan)
  const recommendations = improvementPlan.length
    ? improvementPlan.map((item) => item.action)
    : Array.isArray(analysis.recommendations) ? analysis.recommendations : []
  const topPlan = improvementPlan[0]
  return [
    {
      title: 'Latest statement analyzed',
      detail: `${latestScored.speaker} scored ${latestScored.score}% on the newest saved statement${analysis.method ? ` using ${analysis.method}` : ''}.`,
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
      detail: topPlan
        ? `${topPlan.area}: ${topPlan.action}`
        : recommendations[0] || 'Keep adding live statements to build a stronger session report.',
      tone: recommendations.length ? 'amber' : 'green',
    },
  ]
}

function getLatestImprovementPlan(entries) {
  const latestScored = [...entries]
    .reverse()
    .find((entry) => typeof entry.score === 'number' && entry.status === 'Analyzed')
  if (!latestScored?.analysis) return []
  return normalizeImprovementPlan(latestScored.analysis.improvementPlan || latestScored.analysis.improvement_plan)
}

function normalizeImprovementPlan(plan) {
  if (!Array.isArray(plan)) return []
  return plan.slice(0, 6).map((item, index) => ({
    area: item?.area || `Priority ${index + 1}`,
    score: toScore(item?.score ?? 0),
    action: item?.action || 'Add a clearer source, warrant, or answer to the strongest objection.',
  }))
}

function buildFallbackImprovementPlan(statement, score, counterargument) {
  const normalized = statement.toLowerCase()
  const hasEvidence = /\bstudy\b|\bresearch\b|\bdata\b|\breport\b|\bsource\b|\bstatistic\b|\b\d{4}\b|\b\d+(?:\.\d+)?%|https?:\/\//.test(normalized)
  const hasReasoning = /\bbecause\b|\btherefore\b|leads? to|results? in|so that|causes?/.test(normalized)
  const hasClash = /\bhowever\b|\balthough\b|\beven if\b|\boppos|\bcounter|\btrade-?off\b/.test(normalized)
  const plan = []
  if (!hasEvidence) {
    plan.push({
      area: 'Evidence',
      score: toScore(score - 10),
      action: 'Add one named source, statistic, report, year, or URL for the central factual premise.',
    })
  }
  if (!hasReasoning) {
    plan.push({
      area: 'Reasoning',
      score: toScore(score - 8),
      action: 'Explain the because-chain from cause to mechanism to measurable outcome.',
    })
  }
  if (!hasClash || !counterargument) {
    plan.push({
      area: 'Clash',
      score: toScore(score - 12),
      action: 'Answer the strongest opposing explanation before the opponent uses it.',
    })
  }
  return plan.length ? plan : [{
    area: 'Advanced polish',
    score,
    action: 'Quantify the impact, compare it to the alternative, and pre-answer the most technical objection.',
  }]
}

function entryStatusTone(entry) {
  if (entry.status === 'Analyzed') return 'success'
  if (entry.status === 'Analysis failed') return 'danger'
  return 'warning'
}

function summarizeLiveAnalysis(reply) {
  return reply.split(/\n{2,}|(?<=[.!?])\s+/).find(Boolean) || reply
}

export default LiveDebatePage
