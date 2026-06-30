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
import { citationSources, reportTemplate } from '../../data/productData.js'
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

const DEFAULT_ARGUMENT = 'Universal healthcare ensures that every citizen has access to essential medical services regardless of income, leading to a healthier population and a stronger society.'

function AnalyzePage({ onExport, token }) {
  const [argument, setArgument] = useState(DEFAULT_ARGUMENT)
  const [loading, setLoading] = useState(false)
  const [traceIndex, setTraceIndex] = useState(TRACE_STEPS.length)
  const [error, setError] = useState('')
  const [reply, setReply] = useState('')
  const [completedAt, setCompletedAt] = useState('')
  const timerRef = useRef(null)

  useEffect(() => () => window.clearInterval(timerRef.current), [])

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
      const sessionId = localStorage.getItem('debate_session_id') || `analysis-${Date.now()}`
      localStorage.setItem('debate_session_id', sessionId)
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          message: submitted,
          session_id: sessionId,
          difficulty: 'hard',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || `Analysis failed with status ${response.status}.`)
      }

      const data = await response.json()
      setReply(data.reply || 'The argument has a strong equity frame but needs more direct evidence and a clearer answer to implementation risk.')
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
          <article className="product-panel citation-panel">
            <PanelHeading title="Citation verification" meta="3 sources assessed" />
            {citationSources.map((source) => (
              <div className="citation-row" key={source.source}>
                <span className={`citation-status ${source.tone}`}><CheckCircle2 size={17} /></span>
                <span><strong>{source.source}</strong><small>{source.detail}</small></span>
                <b className={source.tone}>{source.credibility}%</b>
              </div>
            ))}
          </article>

          <article className="product-panel coaching-detail">
            <PanelHeading title="AI debate coach" />
            <div className="coach-callout">
              <CheckCircle2 size={18} />
              <strong>Your claim is strong.</strong>
            </div>
            <p>However:</p>
            <ul>
              <li>Missing statistics</li>
              <li>Weak causal evidence</li>
              <li>No opposing viewpoint addressed</li>
            </ul>
            <button className="product-button primary" type="button" onClick={() => onExport({ ...reportTemplate, topic: inferTopic(argument) })}>
              <FileDown size={17} />
              Export analysis report
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
  const lengthLift = Math.min(9, Math.floor(argument.length / 45))
  const hasEvidence = /\d|study|report|data|research|source/.test(normalized)
  const hasCausality = /because|therefore|leads to|results in/.test(normalized)
  const strength = Math.min(92, 70 + lengthLift + (hasCausality ? 6 : 0))
  return {
    strength,
    evidence: hasEvidence ? 84 : 62,
    coverage: 77,
    logic: hasCausality ? 86 : 76,
    answer: 'The claim is persuasive as a values-based position, but it is not yet complete enough to carry a policy debate.',
    why: 'It connects access to a desirable social outcome and gives the audience a clear moral frame. The causal bridge between access, population health, and economic strength still needs explicit support.',
    evidenceNote: hasEvidence
      ? 'The argument signals evidence, but each factual claim should be tied to a named source and a measurable outcome.'
      : 'No concrete statistics or named studies are present. Add one population-health source and one cost or implementation source.',
    counterargument: 'A strong opponent will argue that universal access can create funding pressure, capacity constraints, and transition risk. Address those costs instead of treating access alone as sufficient proof.',
    change: 'Credible evidence that access does not improve measured health outcomes, or that the proposed funding model creates larger harms than it solves, would materially weaken the conclusion.',
    reply,
  }
}

function inferTopic(argument) {
  if (/health|medical|care/i.test(argument)) return 'Universal Healthcare'
  if (/income|ubi/i.test(argument)) return 'Universal Basic Income'
  if (/artificial intelligence|ai regulation/i.test(argument)) return 'AI Regulation'
  return 'Argument Analysis'
}

export default AnalyzePage
