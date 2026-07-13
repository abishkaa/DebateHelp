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
import { productApi } from '../../services/productApi.js'

function OverviewPage({ currentUser, navigateTo, onExport, token }) {
  const [dashboard, setDashboard] = useState(null)
  const [teamMembers, setTeamMembers] = useState(() => (currentUser ? [buildCurrentTeamMember(currentUser)] : []))
  const [sharedArgumentCount, setSharedArgumentCount] = useState(0)
  const [syncing, setSyncing] = useState(Boolean(token))

  useEffect(() => {
    let active = true
    if (!token) {
      setSyncing(false)
      return undefined
    }

    const dashboardRequest = productApi.dashboard(token)
    const teamRequest = productApi.team(token)
    const sharedArgumentsRequest = productApi.sharedArguments(token)

    dashboardRequest
      .then((data) => {
        if (active) setDashboard(data)
      })
      .catch(() => null)

    teamRequest
      .then((data) => {
        if (active) setTeamMembers(data.members || [])
      })
      .catch(() => null)

    sharedArgumentsRequest
      .then((data) => {
        if (active) setSharedArgumentCount(data.arguments?.length || 0)
      })
      .catch(() => null)

    Promise.allSettled([dashboardRequest, teamRequest, sharedArgumentsRequest])
      .finally(() => {
        if (active) setSyncing(false)
      })

    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    if (!currentUser || token) return
    setTeamMembers([buildCurrentTeamMember(currentUser)])
  }, [currentUser, token])

  const metrics = dashboard?.metrics || []
  const chartValues = dashboard?.progress_series?.length ? dashboard.progress_series : []
  const milestoneData = dashboard?.achievements || []
  const insightData = dashboard?.insights || []
  const sessionData = useMemo(() => dashboard?.recent_sessions || [], [dashboard])
  const hasSessions = sessionData.length > 0
  const latestSession = sessionData[0]
  const currentUserName = currentUser?.full_name || currentUser?.email || 'You'
  const teamMemberCount = teamMembers.length
  const pendingTeamCount = teamMembers.filter((member) => member.status === 'Invited').length
  const frequencyInsight = insightData.find((insight) => insight.title === 'Practice frequency')
  const improvementInsight = insightData.find((insight) => insight.title === 'Average improvement')
  const strongestInsight = insightData.find((insight) => insight.title === 'Strongest saved topic')
  const priorityInsight = insightData.find((insight) => insight.title === 'Coaching priority')

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
        {metrics.length ? metrics.map((metric) => (
            <article className={`metric-block ${metric.tone}`} key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.change}</small>
              {metric.detail ? <em>{metric.detail}</em> : null}
            </article>
          )) : (
            <article className="metric-block amber metric-block-empty">
              <span>{syncing ? 'Syncing real metrics' : 'No activity measured'}</span>
              <strong>{syncing ? 'Loading' : 'No data'}</strong>
              <small>{syncing ? 'Reading saved debate activity' : 'Analyze your first argument to generate real stats.'}</small>
            </article>
          )}
      </section>

      <section className="overview-primary-grid">
        <article className="product-panel progress-panel">
          <PanelHeading
            title="Persuasiveness over time"
            meta={syncing ? 'Syncing...' : (chartValues.length ? 'Real saved sessions' : 'No real sessions yet')}
          />
          <ProgressChart values={chartValues} />
          <p className="chart-note">
            <i />
            {chartValues.length
              ? 'This chart only uses sessions saved to your account.'
              : 'Your first saved analysis will draw this chart.'}
          </p>
        </article>

        <article className="product-panel growth-panel">
          <PanelHeading title="Strengths and growth areas" />
          <div className="growth-columns">
            <GrowthList
              title="Strengths"
              tone="green"
              items={hasSessions ? [
                [strongestInsight?.title || 'Latest score', strongestInsight?.detail || `${latestSession.score}% on ${latestSession.topic}.`],
                [frequencyInsight?.title || 'Saved work', frequencyInsight?.detail || `${sessionData.length} real session${sessionData.length === 1 ? '' : 's'} recorded.`],
              ] : [
                ['No signal yet', 'Analyze an argument to measure strengths from real work.'],
              ]}
            />
            <GrowthList
              title="Needs improvement"
              tone="amber"
              items={hasSessions ? [
                [priorityInsight?.title || 'Coaching priority', priorityInsight?.detail || 'Open the report view to find the weakest saved session.'],
                [improvementInsight?.title || 'Average improvement', improvementInsight?.detail || 'Need at least two saved sessions to calculate progress.'],
              ] : [
                ['Waiting for data', 'No weak spots will be guessed before you create a real session.'],
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
            {sessionData.length ? (
              sessionData.slice(0, 3).map((session) => (
                <button key={session.id} type="button" onClick={() => navigateTo(`/app/reports?session=${encodeURIComponent(session.id)}`)}>
                  <span className="session-icon"><TrendingUp size={17} /></span>
                  <span>
                    <strong>{session.title}</strong>
                    <small>{session.date}</small>
                  </span>
                  <b className={session.score >= 80 ? 'positive' : 'contested'}>{session.score}%</b>
                  <ArrowRight size={16} />
                </button>
              ))
            ) : (
              <div className="panel-empty-state">
                <strong>No real sessions yet.</strong>
                <p>Analyze an argument and it will appear here with its real score and report.</p>
                <button type="button" onClick={() => navigateTo('/app/analyze?new=1')}>
                  Start first analysis <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        </article>

        <article className="product-panel">
          <PanelHeading
            title="Professional milestones"
            actionLabel="View profile"
            onAction={() => navigateTo('/app/profile')}
          />
          <div className="achievement-list">
            {milestoneData.length ? milestoneData.map((achievement) => (
                <div key={achievement.title}>
                  <span className={`achievement-symbol ${achievement.tone}`}><Award size={19} /></span>
                  <span>
                    <strong>{achievement.title}</strong>
                    <small>{achievement.description}</small>
                  </span>
                  <b>{achievement.status}</b>
                </div>
              )) : (
                <div className="panel-empty-state compact">
                  <strong>{syncing ? 'Loading milestones...' : 'No milestones calculated yet.'}</strong>
                  <p>Milestones are generated from saved sessions and analyzed arguments.</p>
                </div>
              )}
          </div>
        </article>

        <article className="product-panel coach-panel">
          <PanelHeading title="AI coaching notes" />
          {hasSessions ? (
            <>
              <div className="coach-lead">
                <CheckCircle2 size={18} />
                <span>
                  <strong>Latest real score: {latestSession.score}%.</strong>
                  <small>{latestSession.title} - {latestSession.date}</small>
                </span>
              </div>
              <p>Next useful moves:</p>
              <ul>
                {insightData.length ? insightData.slice(0, 3).map((insight) => (
                  <li key={insight.title}>{insight.title}: {insight.detail}</li>
                )) : (
                  <li>Open the saved report and revise the weakest claim from your latest real session.</li>
                )}
              </ul>
            </>
          ) : (
            <div className="panel-empty-state compact">
              <strong>No coaching notes yet.</strong>
              <p>Coaching is generated from your real saved analyses, not demo data.</p>
            </div>
          )}
          <button type="button" onClick={() => navigateTo('/app/analyze')}>
            View full coaching report <ArrowRight size={15} />
          </button>
        </article>
      </section>

      <section className="overview-bottom-grid">
        <article className="product-panel team-summary">
          <PanelHeading
            title="Team workspace"
            meta={syncing ? 'Syncing real team' : `${teamMemberCount} member${teamMemberCount === 1 ? '' : 's'} loaded`}
          />
          <div className="team-summary-stats">
            <div><Users size={18} /><strong>{teamMemberCount}</strong><span>Members</span></div>
            <div><Lightbulb size={18} /><strong>{sharedArgumentCount}</strong><span>Shared arguments</span></div>
            <div><Target size={18} /><strong>{pendingTeamCount}</strong><span>Pending invites</span></div>
          </div>
          <div className="collaboration-row">
            <div className="avatar-stack">
              {teamMembers.slice(0, 4).map((member) => (
                <span key={member.email || member.id}>{member.initials}</span>
              ))}
              {teamMembers.length > 4 && <span>+{teamMembers.length - 4}</span>}
            </div>
            <div className="live-collaborators">
              <i />
              <span><strong>{currentUserName}</strong> is ready to collaborate</span>
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
          <button type="button" onClick={() => navigateTo('/app/reports')}>
            <FileDown size={18} /><span><strong>Export professional report</strong><small>Choose a real saved session first</small></span><ArrowRight size={16} />
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
  if (!values.length) {
    return (
      <div className="progress-chart empty">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="No real persuasiveness data yet">
          {[0, 1, 2, 3].map((lineIndex) => {
            const y = 18 + lineIndex * 55
            return <line className="chart-gridline" key={lineIndex} x1="30" x2={width - 30} y1={y} y2={y} />
          })}
          <text className="chart-empty-label" x={width / 2} y={height / 2}>No real sessions yet</text>
        </svg>
      </div>
    )
  }

  const lastValue = values.at(-1)
  const denominator = Math.max(1, values.length - 1)
  const points = values.map((value, index) => {
    const x = 30 + (index / denominator) * (width - 60)
    const y = 18 + ((max - value) / (max - min)) * (height - 55)
    return [x, y]
  })
  const line = points.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `30,${height - 37} ${line} ${width - 30},${height - 37}`

  return (
    <div className="progress-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Latest real persuasiveness score is ${lastValue} percent`}>
        {[0, 1, 2, 3].map((lineIndex) => {
          const y = 18 + lineIndex * 55
          return <line className="chart-gridline" key={lineIndex} x1="30" x2={width - 30} y1={y} y2={y} />
        })}
        <polygon className="chart-area" points={area} />
        <polyline className="chart-line" points={line} />
        <circle className="chart-dot" cx={points.at(-1)[0]} cy={points.at(-1)[1]} r="5" />
        <text className="chart-label" x={points.at(-1)[0] - 18} y={points.at(-1)[1] - 12}>{lastValue}%</text>
      </svg>
    </div>
  )
}

export default OverviewPage

function getInitials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'U'
}

function buildCurrentTeamMember(currentUser) {
  const name = currentUser.full_name || currentUser.email || 'Current User'
  return {
    email: currentUser.email,
    id: currentUser.id || currentUser.email,
    initials: getInitials(name),
    name,
    role: currentUser.role || 'Workspace owner',
    status: 'Active',
    tone: 'green',
    is_current: true,
  }
}
