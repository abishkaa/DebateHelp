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
import { buildApiUrl, networkErrorMessage } from '../../services/apiConfig.js'
import { PanelHeading, PageHeading } from './OverviewPage.jsx'

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
  const [backendAnalysis, setBackendAnalysis] = useState(null)
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
      setBackendAnalysis(null)
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
    setBackendAnalysis(null)
    setTraceIndex(0)
    timerRef.current = window.setInterval(() => {
      setTraceIndex((current) => Math.min(current + 1, TRACE_STEPS.length - 1))
    }, 560)

    try {
      const activeSessionId = sessionIdRef.current
      let response
      try {
        response = await fetch(buildApiUrl('/chat'), {
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
      } catch {
        throw new Error(networkErrorMessage('analysis service'))
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        const fallback = response.status >= 500
          ? networkErrorMessage('analysis service')
          : `Analysis failed with status ${response.status}.`
        throw new Error(data.detail || fallback)
      }

      const data = await response.json()
      if (!data.reply) throw new Error('Analysis service returned an empty response.')
      setReply(data.reply)
      setBackendAnalysis(data.analysis || null)
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

  const resetAnalysis = () => {
    setArgument('')
    setReply('')
    setBackendAnalysis(null)
    setSessionId('')
    setCompletedAt('')
    setError('')
    setTraceIndex(TRACE_STEPS.length)
    sessionIdRef.current = createSessionId('analysis')
  }

  const analysis = useMemo(() => buildAnalysis(reply, backendAnalysis), [reply, backendAnalysis])
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
          <button className="product-button secondary" type="button" onClick={resetAnalysis}>
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
          <PanelHeading title="Strategy output" meta={analysis.method ? 'Real computed analysis' : reply ? 'Updated now' : 'Ready to deploy'} />
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
            <PanelHeading title="Citation verification" meta={`${analysis.sources.length} evidence signals`} />
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
            {analysis.fallacies.length ? (
              <div className="analysis-risk-list">
                <strong>Reasoning risks</strong>
                {analysis.fallacies.map((fallacy) => (
                  <div key={`${fallacy.name}-${fallacy.excerpt || fallacy.detail}`}>
                    <b>{fallacy.name}</b>
                    <span>{fallacy.detail}</span>
                  </div>
                ))}
              </div>
            ) : reply ? (
              <div className="analysis-risk-list clean">
                <strong>Reasoning risks</strong>
                <span>No major fallacy pattern was detected by the local analyzer.</span>
              </div>
            ) : null}
          </article>

          <article className="product-panel coaching-detail">
            <PanelHeading title="AI debate coach" meta={analysis.method ? 'NLP scoring' : undefined} />
            {reply ? (
              <>
                <div className="coach-callout">
                  <CheckCircle2 size={18} />
                  <strong>Real analysis saved.</strong>
                </div>
                <p>{analysis.coachSummary}</p>
                {analysis.recommendations.length ? (
                  <ul>
                    {analysis.recommendations.map((recommendation) => (
                      <li key={recommendation}>{recommendation}</li>
                    ))}
                  </ul>
                ) : null}
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

function buildAnalysis(reply, backendAnalysis) {
  const scores = backendAnalysis?.scores || {}
  const hasBackendAnalysis = Boolean(backendAnalysis && Object.keys(scores).length)
  if (hasBackendAnalysis) {
    return {
      strength: toScore(scores.strength),
      evidence: toScore(scores.evidence),
      coverage: toScore(scores.coverage),
      logic: toScore(scores.logic),
      answer: backendAnalysis.answer || reply || 'The analyzer returned a saved response without a separate answer summary.',
      why: backendAnalysis.why || 'This score combines claim clarity, evidence, reasoning, clash coverage, readability, and fallacy checks.',
      evidenceNote: backendAnalysis.evidenceNote || 'No evidence note was returned for this argument.',
      counterargument: backendAnalysis.counterargument || 'No specific counterargument was detected yet.',
      change: backendAnalysis.change || 'Revise the claim or evidence, then run analysis again to update the conclusion.',
      coachSummary: backendAnalysis.coachSummary || summarizeReply(reply),
      sources: normalizeSources(backendAnalysis.sources),
      fallacies: normalizeFallacies(backendAnalysis.fallacies),
      recommendations: Array.isArray(backendAnalysis.recommendations) ? backendAnalysis.recommendations.slice(0, 5) : [],
      method: backendAnalysis.method || 'computed_analysis',
      reply,
    }
  }

  return {
    strength: 0,
    evidence: 0,
    coverage: 0,
    logic: 0,
    answer: 'Run an analysis to generate a saved DebateHelp response.',
    why: 'No backend analysis has been run for this text yet.',
    evidenceNote: 'Citation verification starts after you run the analysis.',
    counterargument: 'Counterargument guidance appears after a saved analysis response exists.',
    change: 'No conclusion has been generated yet.',
    coachSummary: '',
    sources: [],
    fallacies: [],
    recommendations: [],
    method: '',
    reply,
  }
}

function toScore(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(100, Math.round(number)))
}

function normalizeSources(sources) {
  if (!Array.isArray(sources)) return []
  return sources.slice(0, 6).map((source, index) => ({
    source: source.source || `Evidence signal ${index + 1}`,
    detail: source.detail || 'Evidence signal detected in the submitted argument.',
    credibility: toScore(source.credibility ?? 50),
    tone: source.tone || 'amber',
  }))
}

function normalizeFallacies(fallacies) {
  if (!Array.isArray(fallacies)) return []
  return fallacies.slice(0, 4).map((fallacy) => ({
    name: fallacy.name || 'Reasoning risk',
    detail: fallacy.detail || 'Review this reasoning step before presenting it.',
    excerpt: fallacy.excerpt || '',
  }))
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
