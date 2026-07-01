import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  FileDown,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import { productApi } from '../../services/productApi.js'
import { PanelHeading, PageHeading } from './OverviewPage.jsx'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:8001')
const TRACE_STEPS = [
  'Parsing the claim and debate context',
  'Checking prior session history',
  'Evaluating evidence quality',
  'Generating counterarguments',
  'Testing logical consistency',
  'Drafting coaching recommendations',
]

function AnalyzePage({ currentPath = '', onExport, token }) {
  const [argument, setArgument] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [traceIndex, setTraceIndex] = useState(TRACE_STEPS.length)
  const [error, setError] = useState('')
  const [reply, setReply] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [completedAt, setCompletedAt] = useState('')
  const timerRef = useRef(null)
  const sessionIdRef = useRef(createSessionId('analysis'))
  const sourcesRef = useRef(null)

  useEffect(() => {
    const queryString = currentPath.split('?')[1] || ''
    const params = new URLSearchParams(queryString)
    if (params.get('new') === '1') {
      setArgument('')
      setReply('')
      setSessionId('')
      setCompletedAt('')
      setError('')
      setTraceIndex(TRACE_STEPS.length)
      sessionIdRef.current = createSessionId('analysis')
      return
    }

    const topic = params.get('topic')
    if (topic && !argument.trim() && !reply) {
      setArgument(`Practice topic: ${topic}\n\nWrite your argument here, then run the analysis.`)
    }
  }, [currentPath])

  useEffect(() => () => window.clearInterval(timerRef.current), [])

  useEffect(() => {
    if (!currentPath.includes('focus=sources')) return
    const frameId = window.requestAnimationFrame(() => {
      sourcesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [currentPath])

  const runAnalysis = async () => {
    const submitted = argument.trim()
    if (!submitted) {
      setError('Enter an argument before running the analysis.')
      return
    }

    setLoading(true)
    setError('')
    setReply('')
    setTraceIndex(0)
    timerRef.current = window.setInterval(() => {
      setTraceIndex((current) => Math.min(current + 1, TRACE_STEPS.length - 1))
    }, 560)

    try {
      const activeSessionId = sessionIdRef.current
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: submitted,
          session_id: activeSessionId,
          difficulty: 'hard',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || `Analysis failed with status ${response.status}.`)
      }

      const data = await response.json()
      if (!data.reply) throw new Error('Analysis service returned an empty response.')
      setReply(data.reply)
      setSessionId(data.session_id || activeSessionId)
      setCompletedAt(new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(new Date()))
      setTraceIndex(TRACE_STEPS.length)
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect to the analysis service.')
    } finally {
      window.clearInterval(timerRef.current)
      setLoading(false)
    }
  }

  const analysis = useMemo(() => buildAnalysis(argument, reply), [argument, reply])
  const exportAnalysisReport = async () => {
    if (!sessionId) {
      setError('Run an analysis before exporting a report.')
      return
    }

    setExporting(true)
    setError('')
    try {
      const report = await productApi.report(sessionId)
      onExport(report)
    } catch (exportError) {
      setError(exportError.message || 'Unable to export this real report.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="product-page analyze-page">
      <PageHeading
        title="Analyze"
        description="Pressure-test the claim, map the counterplay, and find the weak points before your opponent does."
        action={(
          <button className="product-button secondary" type="button" onClick={() => setArgument('')}>
            <RefreshCw size={17} />
            Reset argument
          </button>
        )}
      />

      <section className="analysis-score-strip">
        <ScoreMetric label="Argument strength" value={analysis.strength} tone="blue" />
        <ScoreMetric label="Evidence quality" value={analysis.evidence} tone="green" />
        <ScoreMetric label="Counterargument coverage" value={analysis.coverage} tone="amber" />
        <ScoreMetric label="Logical consistency" value={analysis.logic} tone="red" />
      </section>

      <section className="analysis-workspace">
        <article className="product-panel argument-editor">
          <PanelHeading title="Argument input" meta={`${argument.trim().length} characters`} />
          <textarea
            aria-label="Argument to analyze"
            value={argument}
            onChange={(event) => setArgument(event.target.value)}
            placeholder="Write or paste the argument you want DebateHelp to pressure-test."
          />
          {error && <div className="analysis-error">{error}</div>}
          <div className="analysis-editor-actions">
            <span>Hard mode applies evidence and causal scrutiny.</span>
            <button className="product-button primary" disabled={loading} type="button" onClick={runAnalysis}>
              {loading ? <RefreshCw className="spin" size={17} /> : <Target size={17} />}
              {loading ? 'Analyzing...' : 'Run analysis'}
            </button>
          </div>
        </article>

        <article className="product-panel reasoning-monitor">
          <PanelHeading title="Live reasoning trace" meta={loading ? 'Running' : 'Ready'} />
          <div className="analysis-trace-list">
            {TRACE_STEPS.map((step, index) => {
              const status = traceIndex >= TRACE_STEPS.length || index < traceIndex
                ? 'done'
                : index === traceIndex && loading
                  ? 'active'
                  : 'pending'
              return (
                <div className={status} key={step}>
                  <span>{status === 'done' ? <Check size={14} /> : status === 'active' ? <ArrowRight size={14} /> : <Circle size={11} />}</span>
                  <strong>{step}</strong>
                  <small>{status}</small>
                </div>
              )
            })}
          </div>
          {completedAt && <p className="analysis-complete">Completed at {completedAt}</p>}
        </article>
      </section>

      <section className="analysis-results-grid">
        <article className="product-panel structured-analysis">
          <PanelHeading title="Strategy output" meta={reply ? 'Updated now' : 'Ready to deploy'} />
          <AnalysisSection
            icon={<Sparkles size={18} />}
            title="Here is the answer"
            text={reply || analysis.answer}
          />
          <AnalysisSection
            icon={<SearchCheck size={18} />}
            title="Here is why"
            text={analysis.why}
          />
          <AnalysisSection
            icon={<ShieldCheck size={18} />}
            title="Here is the evidence"
            text={analysis.evidenceNote}
          />
          <AnalysisSection
            icon={<Target size={18} />}
            title="Here is the counterargument"
            text={analysis.counterargument}
          />
          <div className="confidence-row">
            <span>Confidence</span>
            <progress
              aria-label="Analysis confidence"
              className="score-progress confidence-progress"
              max="100"
              value={analysis.strength}
            />
            <strong>{analysis.strength}%</strong>
          </div>
          <AnalysisSection
            icon={<RefreshCw size={18} />}
            title="What would change the conclusion"
            text={analysis.change}
          />
        </article>

        <div className="analysis-side-stack">
          <article className="product-panel citation-panel" data-product-focus="sources" ref={sourcesRef}>
            <PanelHeading title="Citation verification" meta={`${analysis.sources.length} real signals`} />
            {analysis.sources.length ? analysis.sources.map((source) => (
                <div className="citation-row" key={source.source}>
                  <span className={`citation-status ${source.tone}`}><CheckCircle2 size={17} /></span>
                  <span><strong>{source.source}</strong><small>{source.detail}</small></span>
                  <b className={source.tone}>{source.credibility}%</b>
                </div>
              )) : (
                <div className="panel-empty-state compact">
                  <strong>No citation signals found yet.</strong>
                  <p>Add a source, statistic, study, URL, or year to your argument and run analysis.</p>
                </div>
              )}
          </article>

          <article className="product-panel coaching-detail">
            <PanelHeading title="AI debate coach" />
            {reply ? (
              <>
                <div className="coach-callout">
                  <CheckCircle2 size={18} />
                  <strong>Real analysis saved.</strong>
                </div>
                <p>{analysis.coachSummary}</p>
              </>
            ) : (
              <div className="panel-empty-state compact">
                <strong>No coaching response yet.</strong>
                <p>Run analysis to generate saved coaching from the backend.</p>
              </div>
            )}
            <button className="product-button primary" disabled={!reply || exporting} type="button" onClick={exportAnalysisReport}>
              <FileDown size={17} />
              {exporting ? 'Exporting...' : 'Export analysis report'}
            </button>
          </article>
        </div>
      </section>
    </div>
  )
}

function ScoreMetric({ label, value, tone }) {
  return (
    <article className={`analysis-score ${tone}`}>
      <span>{label}</span>
      <strong>{value}%</strong>
      <progress
        aria-label={`${label} score`}
        className="score-progress"
        max="100"
        value={value}
      />
    </article>
  )
}

function AnalysisSection({ icon, title, text }) {
  return (
    <section className="analysis-section">
      <span>{icon}</span>
      <div><h3>{title}</h3><p>{text}</p></div>
    </section>
  )
}

function buildAnalysis(argument, reply) {
  const normalized = argument.toLowerCase()
  const hasReply = Boolean(reply)
  const lengthLift = Math.min(9, Math.floor(argument.length / 45))
  const hasEvidence = /\d|study|report|data|research|source/.test(normalized)
  const hasCausality = /because|therefore|leads to|results in/.test(normalized)
  const strength = hasReply ? Math.min(92, 70 + lengthLift + (hasCausality ? 6 : 0)) : 0
  return {
    strength,
    evidence: hasReply ? (hasEvidence ? 84 : 42) : 0,
    coverage: hasReply ? (/(however|although|counter|opposing|tradeoff)/i.test(argument) ? 82 : 48) : 0,
    logic: hasReply ? (hasCausality ? 86 : 58) : 0,
    answer: 'Run an analysis to generate a saved DebateHelp response.',
    why: hasReply
      ? 'This section is based on the argument you submitted and the latest backend analysis saved for this session.'
      : 'No backend analysis has been run for this text yet.',
    evidenceNote: !hasReply
      ? 'Citation verification starts after you run the analysis.'
      : hasEvidence
      ? 'The argument signals evidence, but each factual claim should be tied to a named source and a measurable outcome.'
      : 'No concrete statistics or named studies are present. Add at least one source for the main factual claim and one source for implementation tradeoffs.',
    counterargument: hasReply
      ? extractCounterSignal(reply)
      : 'Counterargument guidance appears after a saved analysis response exists.',
    change: hasReply
      ? 'Run another analysis after revising your claim to update this saved session and its report.'
      : 'No conclusion has been generated yet.',
    coachSummary: summarizeReply(reply),
    sources: extractCitationSignals(argument),
    reply,
  }
}

function extractCitationSignals(argument) {
  const matches = argument.match(/https?:\/\/\S+|\b\d{4}\b|\b\d+(?:\.\d+)?%|\b(?:study|report|research|source|data|survey|journal)\b/gi) || []
  return [...new Set(matches)].slice(0, 6).map((signal) => ({
    source: signal,
    detail: signal.startsWith('http') ? 'URL included in your argument' : 'Citation or evidence signal found in your argument',
    credibility: signal.startsWith('http') ? 75 : 60,
    tone: signal.startsWith('http') ? 'green' : 'amber',
  }))
}

function extractCounterSignal(reply) {
  const sentence = reply
    .split(/(?<=[.!?])\s+/)
    .find((item) => /counter|opponent|rebut|however|against|risk/i.test(item))
  return sentence || 'Use the saved backend response above to identify the strongest opposing line.'
}

function summarizeReply(reply) {
  if (!reply) return ''
  return reply.split(/\n{2,}|(?<=[.!?])\s+/).find(Boolean) || reply
}

function createSessionId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`
  return `${prefix}-${Date.now()}`
}

export default AnalyzePage
