import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, FileText, MessageSquareText, Plus, Users } from 'lucide-react'
import { sharedArguments, teamMembers } from '../../data/productData.js'
import { PanelHeading, PageHeading } from './OverviewPage.jsx'

const ACTIVITY = [
  'Abish is editing the opening argument',
  'Sarah is reviewing evidence quality',
  'Daniel added a citation',
  'Noah left a coaching note',
]

function TeamPage() {
  const [activityIndex, setActivityIndex] = useState(0)
  const [selectedArgument, setSelectedArgument] = useState(sharedArguments[0])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActivityIndex((current) => (current + 1) % ACTIVITY.length)
    }, 2800)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="product-page team-page">
      <PageHeading
        title="Squad sync"
        description="Build cases together, review evidence, and watch the shared argument mutate in real time."
        action={<button className="product-button primary" type="button"><Plus size={17} /> Invite member</button>}
      />

      <section className="team-metric-strip">
        <div><Users size={19} /><span>Members</span><strong>5</strong></div>
        <div><FileText size={19} /><span>Shared arguments</span><strong>32</strong></div>
        <div><MessageSquareText size={19} /><span>Current topic</span><strong>AI Regulation</strong></div>
        <div className="collab-pulse"><i /><span>{ACTIVITY[activityIndex]}</span></div>
      </section>

      <section className="team-workspace-grid">
        <article className="product-panel team-members-panel">
          <PanelHeading title="Members" meta="5 total" />
          <div className="team-member-list">
            {teamMembers.map((member) => (
              <div key={member.name}>
                <span className="product-avatar">{member.initials}</span>
                <span><strong>{member.name}</strong><small>{member.role}</small></span>
                <b className={member.tone}><i /> {member.status}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="product-panel shared-arguments-panel">
          <PanelHeading title="Shared arguments" meta="AI Regulation" />
          <div className="shared-argument-list">
            {sharedArguments.map((argument) => (
              <button
                className={selectedArgument.title === argument.title ? 'selected' : ''}
                key={argument.title}
                type="button"
                onClick={() => setSelectedArgument(argument)}
              >
                <span>
                  <strong>{argument.title}</strong>
                  <small>{argument.owner} - {argument.citations} citations</small>
                </span>
                <b>{argument.quality}%</b>
                <em>{argument.status}</em>
              </button>
            ))}
          </div>
        </article>

        <article className="product-panel team-review-panel">
          <PanelHeading title="Argument review" meta="Live document" />
          <div className="live-editing-line"><i /> Sarah is reviewing this paragraph...</div>
          <h3>{selectedArgument.title}</h3>
          <p>
            A risk-based regulatory model preserves room for low-risk innovation while requiring independent
            accountability for systems that affect employment, healthcare, education, and public safety.
          </p>
          <div className="review-notes">
            <div><CheckCircle2 size={17} /><span><strong>Logical structure</strong><small>The policy mechanism follows the stated risk.</small></span></div>
            <div><MessageSquareText size={17} /><span><strong>Sarah</strong><small>Add a source defining high-risk use cases.</small></span></div>
          </div>
          <button className="panel-action" type="button">Open collaborative editor <ArrowRight size={15} /></button>
        </article>
      </section>
    </div>
  )
}

export default TeamPage
