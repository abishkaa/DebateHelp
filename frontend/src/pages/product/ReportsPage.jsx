import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Scale,
  ShieldCheck,
  Target,
} from 'lucide-react'
import { productApi } from '../../services/productApi.js'
import { PanelHeading, PageHeading } from './OverviewPage.jsx'

function ReportsPage({ currentPath = '', onExport, token }) {
  const requestedSessionId = useMemo(() => {
    const queryString = currentPath.split('?')[1] || ''
    return new URLSearchParams(queryString).get('session') || ''
  }, [currentPath])
  const [sessions, setSessions] = useState([])
  const [selected, setSelected] = useState(null)
  const [reportsById, setReportsById] = useState({})
  const [reportError, setReportError] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [syncing, setSyncing] = useState(Boolean(token))

  useEffect(() => {
    let active = true
    if (!token) {
      setSyncing(false)
      return undefined
    }

    productApi.sessions(token)
      .then((data) => {
        if (active) setSessions(data.sessions || [])
      })
      .catch(() => null)
      .finally(() => {
        if (active) setSyncing(false)
      })

    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    if (!sessions.length) {
      setSelected(null)
      return
    }

    setSelected(
      sessions.find((session) => session.id === requestedSessionId) || sessions[0],
    )
  }, [requestedSessionId, sessions])

  useEffect(() => {
    let active = true
    if (!selected?.id || reportsById[selected.id]) {
      setReportError('')
      return undefined
    }

    setReportLoading(true)
    setReportError('')
    productApi.report(selected.id)
      .then((data) => {
        if (active) setReportsById((current) => ({ ...current, [selected.id]: data }))
      })
      .catch((error) => {
        if (active) setReportError(error.message || 'Unable to load this real report.')
      })
      .finally(() => {
        if (active) setReportLoading(false)
      })

    return () => {
      active = false
    }
  }, [reportsById, selected])

  const report = selected ? reportsById[selected.id] : null

  return (
    <div className="product-page reports-page">
      <PageHeading
        title="Strategy dossier"
        description="Turn a debate analysis into a shareable neon-black PDF dossier."
        action={(
          <button className="product-button primary" disabled={!report} type="button" onClick={() => report && onExport(report)}>
            <Download size={17} />
            Export dossier
          </button>
        )}
      />

      <section className="reports-layout">
        <aside className="product-panel report-session-list">
          <PanelHeading title="Analyzed sessions" meta={syncing ? 'Syncing...' : `${sessions.length} real saved`} />
          {sessions.length ? (
            sessions.map((session) => (
              <button
                className={selected?.id === session.id ? 'selected' : ''}
                key={session.id}
                type="button"
                onClick={() => setSelected(session)}
              >
                <FileText size={17} />
                <span><strong>{session.title}</strong><small>{session.date}</small></span>
                <b>{session.score}%</b>
                <ChevronRight size={15} />
              </button>
            ))
          ) : (
            <div className="panel-empty-state compact">
              <strong>No real reports yet.</strong>
              <p>Analyze an argument first; saved sessions will appear here.</p>
            </div>
          )}
        </aside>

        {selected && report ? (
          <article className="report-preview" aria-label="Debate analysis report preview">
            <header>
              <span>DebateHelp</span>
              <small>Professional reasoning review</small>
              <strong>{selected.score}%</strong>
            </header>
            <div className="report-preview-body">
              <span>Debate Analysis Report</span>
              <h2>{report.topic}</h2>
              <p className="report-summary">A structured review of your saved session, based only on real activity recorded for this account.</p>

              <ReportSection icon={<Target size={18} />} title="Key Arguments" items={report.keyArguments} />
              <ReportSection icon={<ShieldCheck size={18} />} title="Evidence Assessment" items={report.evidence} />
              <ReportSection icon={<Scale size={18} />} title="Logical Fallacies" items={report.fallacies} />
              <ReportSection icon={<CheckCircle2 size={18} />} title="Counterarguments" items={report.counterarguments} />

              <section className="report-recommendation">
                <strong>Final Recommendation</strong>
                <p>{report.recommendation}</p>
              </section>
            </div>
            <footer>
              <span>Evidence - reasoning - counterargument - confidence</span>
              <span>1 / 1</span>
            </footer>
          </article>
        ) : selected ? (
          <article className="report-preview empty-report" aria-label="Report loading">
            <div className="panel-empty-state">
              <FileText size={28} />
              <strong>{reportLoading ? 'Loading real report...' : 'Unable to load report.'}</strong>
              <p>{reportError || 'DebateHelp is reading the saved session history for this dossier.'}</p>
            </div>
          </article>
        ) : (
          <article className="report-preview empty-report" aria-label="No report selected">
            <div className="panel-empty-state">
              <FileText size={28} />
              <strong>No dossier to preview yet.</strong>
              <p>Create a real analysis session and its report will appear here.</p>
            </div>
          </article>
        )}
      </section>
    </div>
  )
}

function ReportSection({ icon, title, items }) {
  return (
    <section className="report-section">
      <h3>{icon}{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  )
}

export default ReportsPage
