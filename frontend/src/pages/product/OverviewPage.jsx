import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Circle,
  FileDown,
  Lightbulb,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  achievements,
  progressMetrics,
  progressSeries,
  recentSessions,
  teamMembers,
} from '../../data/productData.js'
import { productApi } from '../../services/productApi.js'

function OverviewPage({ currentUser, navigateTo, onExport, token }) {
  const [dashboard, setDashboard] = useState(null)
  const [syncing, setSyncing] = useState(Boolean(token))

  useEffect(() => {
    let active = true
    if (!token) {
      setSyncing(false)
      return undefined
    }

    productApi.dashboard(token)
      .then((data) => {
        if (active) setDashboard(data)
      })
      .catch(() => null)
      .finally(() => {
        if (active) setSyncing(false)
      })

    return () => {
      active = false
    }
  }, [token])

  const metrics = dashboard?.metrics?.length ? dashboard.metrics : progressMetrics
  const chartValues = dashboard?.progress_series?.length ? dashboard.progress_series : progressSeries
  const milestoneData = dashboard?.achievements?.length ? dashboard.achievements : achievements
  const sessionData = useMemo(() => {
    if (!dashboard?.recent_sessions?.length) return recentSessions
    const realTopics = new Set(dashboard.recent_sessions.map((session) => session.topic))
    return [
      ...dashboard.recent_sessions,
      ...recentSessions.filter((session) => !realTopics.has(session.topic)),
    ]
  }, [dashboard])

  return (
    <div className="product-page overview-page">
      <PageHeading
        title="Dashboard"
        description="Your debate intelligence at a glance: progress, recent sessions, coaching signals, and team activity."
        action={(
          <button className="product-button secondary" type="button" onClick={() => navigateTo('/app/profile')}>
            <Target size={17} />
            Tune profile
          </button>
        )}
      />

      <section className="metric-strip" aria-label="Progress metrics">
        {metrics.map((metric) => (
          <article className={`metric-block ${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>
              {metric.change}
              {!metric.change.startsWith('Best:') && <em> vs last 30 days</em>}
            </small>
          </article>
        ))}
      </section>

      <section className="overview-primary-grid">
        <article className="product-panel progress-panel">
          <PanelHeading title="Persuasiveness over time" meta={syncing ? 'Syncing...' : 'Last 30 days'} />
          <ProgressChart values={chartValues} />
          <p className="chart-note"><i /> Consistent improvement. Keep reinforcing your evidence.</p>
        </article>

        <article className="product-panel growth-panel">
          <PanelHeading title="Strengths and growth areas" />
          <div className="growth-columns">
            <GrowthList
              title="Strengths"
              tone="green"
              items={[
                ['Logic', 'You build coherent, well-structured arguments.'],
                ['Rebuttals', 'Strong at identifying and countering opposing points.'],
              ]}
            />
            <GrowthList
              title="Needs improvement"
              tone="amber"
              items={[
                ['Evidence', 'Add more data citations and source credibility.'],
                ['Cross-examination', 'Ask deeper questions to expose weak assumptions.'],
              ]}
            />
          </div>
        </article>
      </section>

      <section className="overview-secondary-grid">
        <article className="product-panel">
          <PanelHeading
            title="Recent sessions"
            actionLabel="View all"
            onAction={() => navigateTo('/app/history')}
          />
          <div className="session-list">
            {sessionData.slice(0, 3).map((session) => (
              <button key={session.id} type="button" onClick={() => navigateTo(`/app/history?session=${session.id}`)}>
                <span className="session-icon"><TrendingUp size={17} /></span>
                <span>
                  <strong>{session.title}</strong>
                  <small>{session.date}</small>
                </span>
                <b className={session.score >= 80 ? 'positive' : 'contested'}>{session.score}%</b>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </article>

        <article className="product-panel">
          <PanelHeading
            title="Professional milestones"
            actionLabel="View profile"
            onAction={() => navigateTo('/app/profile')}
          />
          <div className="achievement-list">
            {milestoneData.map((achievement) => (
              <div key={achievement.title}>
                <span className={`achievement-symbol ${achievement.tone}`}><Award size={19} /></span>
                <span>
                  <strong>{achievement.title}</strong>
                  <small>{achievement.description}</small>
                </span>
                <b>{achievement.status}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="product-panel coach-panel">
          <PanelHeading title="AI coaching notes" />
          <div className="coach-lead">
            <CheckCircle2 size={18} />
            <span>
              <strong>Your claim is strong.</strong>
              <small>You present a clear position with logical structure.</small>
            </span>
          </div>
          <p>However, consider improving:</p>
          <ul>
            <li>Missing statistics to support key claims.</li>
            <li>Weak causal evidence in your main argument.</li>
            <li>No opposing viewpoint addressed proactively.</li>
          </ul>
          <button type="button" onClick={() => navigateTo('/app/analyze')}>
            View full coaching report <ArrowRight size={15} />
          </button>
        </article>
      </section>

      <section className="overview-bottom-grid">
        <article className="product-panel team-summary">
          <PanelHeading title="Team workspace" meta="5 members online" />
          <div className="team-summary-stats">
            <div><Users size={18} /><strong>5</strong><span>Members</span></div>
            <div><Lightbulb size={18} /><strong>32</strong><span>Shared arguments</span></div>
            <div><Target size={18} /><strong>AI Regulation</strong><span>Current topic</span></div>
          </div>
          <div className="collaboration-row">
            <div className="avatar-stack">
              {teamMembers.slice(0, 4).map((member) => (
                <span key={member.initials}>{member.initials}</span>
              ))}
              <span>+1</span>
            </div>
            <div className="live-collaborators">
              <i />
              <span><strong>{currentUser?.full_name || 'Abish Abdikalikov'}</strong> is editing an argument</span>
            </div>
          </div>
          <button className="panel-action" type="button" onClick={() => navigateTo('/app/team')}>
            Open team workspace <ArrowRight size={15} />
          </button>
        </article>

        <article className="product-panel quick-actions">
          <PanelHeading title="Quick actions" />
          <button type="button" onClick={() => navigateTo('/app/analyze')}>
            <Target size={18} /><span><strong>Analyze new argument</strong><small>Start a new AI analysis</small></span><ArrowRight size={16} />
          </button>
          <button type="button" onClick={() => navigateTo('/app/live')}>
            <Circle size={18} /><span><strong>Start live debate</strong><small>Real-time debate with coaching</small></span><ArrowRight size={16} />
          </button>
          <button type="button" onClick={onExport}>
            <FileDown size={18} /><span><strong>Export professional report</strong><small>Generate a consulting-grade PDF</small></span><ArrowRight size={16} />
          </button>
        </article>
      </section>
    </div>
  )
}

export function PageHeading({ title, description, action }) {
  return (
    <header className="product-page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  )
}

export function PanelHeading({ title, meta, actionLabel, onAction }) {
  return (
    <header className="product-panel-heading">
      <h2>{title}</h2>
      {actionLabel ? (
        <button type="button" onClick={onAction}>{actionLabel}</button>
      ) : meta ? <span>{meta}</span> : null}
    </header>
  )
}

function GrowthList({ title, tone, items }) {
  return (
    <div className={`growth-list ${tone}`}>
      <h3>{title}</h3>
      {items.map(([label, detail]) => (
        <div key={label}>
          {tone === 'green' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          <span><strong>{label}</strong><small>{detail}</small></span>
        </div>
      ))}
    </div>
  )
}

function ProgressChart({ values }) {
  const width = 720
  const height = 250
  const min = 45
  const max = 95
  const points = values.map((value, index) => {
    const x = 30 + (index / (values.length - 1)) * (width - 60)
    const y = 18 + ((max - value) / (max - min)) * (height - 55)
    return [x, y]
  })
  const line = points.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `30,${height - 37} ${line} ${width - 30},${height - 37}`

  return (
    <div className="progress-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Persuasiveness increased to 81 percent over the last 30 days">
        {[0, 1, 2, 3].map((lineIndex) => {
          const y = 18 + lineIndex * 55
          return <line className="chart-gridline" key={lineIndex} x1="30" x2={width - 30} y1={y} y2={y} />
        })}
        <polygon className="chart-area" points={area} />
        <polyline className="chart-line" points={line} />
        <circle className="chart-dot" cx={points.at(-1)[0]} cy={points.at(-1)[1]} r="5" />
        <text className="chart-label" x={points.at(-1)[0] - 18} y={points.at(-1)[1] - 12}>81%</text>
      </svg>
    </div>
  )
}

export default OverviewPage
