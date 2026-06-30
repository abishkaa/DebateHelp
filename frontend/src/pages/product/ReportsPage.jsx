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
import { recentSessions, reportTemplate } from '../../data/productData.js'
import { PanelHeading, PageHeading } from './OverviewPage.jsx'

function ReportsPage({ currentPath = '', onExport }) {
  const requestedSessionId = useMemo(() => {
    const queryString = currentPath.split('?')[1] || ''
    return new URLSearchParams(queryString).get('session') || ''
  }, [currentPath])
  const requestedSession = useMemo(
    () => recentSessions.find((session) => session.id === requestedSessionId) || recentSessions[0],
    [requestedSessionId],
  )
  const [selected, setSelected] = useState(requestedSession)

  useEffect(() => {
    setSelected(requestedSession)
  }, [requestedSession])
  const report = { ...reportTemplate, topic: selected.topic, score: selected.score }

  return (
    <div className="product-page reports-page">
      <PageHeading
        title="Strategy dossier"
        description="Turn a debate analysis into a shareable neon-black PDF dossier."
        action={(
          <button className="product-button primary" type="button" onClick={() => onExport(report)}>
            <Download size={17} />
            Export dossier
          </button>
        )}
      />

      <section className="reports-layout">
        <aside className="product-panel report-session-list">
          <PanelHeading title="Analyzed sessions" meta={`${recentSessions.length} available`} />
          {recentSessions.map((session) => (
            <button
              className={selected.id === session.id ? 'selected' : ''}
              key={session.id}
              type="button"
              onClick={() => setSelected(session)}
            >
              <FileText size={17} />
              <span><strong>{session.title}</strong><small>{session.date}</small></span>
              <b>{session.score}%</b>
              <ChevronRight size={15} />
            </button>
          ))}
        </aside>

        <article className="report-preview" aria-label="Debate analysis report preview">
          <header>
            <span>DebateHelp</span>
            <small>Professional reasoning review</small>
            <strong>{selected.score}%</strong>
          </header>
          <div className="report-preview-body">
            <span>Debate Analysis Report</span>
            <h2>{selected.topic}</h2>
            <p className="report-summary">A structured review of the argument, supporting evidence, logical risk, counterarguments, and the strongest next revision.</p>

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
