import { useEffect, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  FileText,
  Mail,
  MessageSquareText,
  Plus,
  Save,
  Users,
  X,
} from 'lucide-react'
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
  const [members, setMembers] = useState(teamMembers)
  const [selectedArgument, setSelectedArgument] = useState(sharedArguments[0])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Debater')
  const [inviteMessage, setInviteMessage] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorContent, setEditorContent] = useState(() => buildArgumentDraft(sharedArguments[0]))
  const [editorMessage, setEditorMessage] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActivityIndex((current) => (current + 1) % ACTIVITY.length)
    }, 2800)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setEditorContent(buildArgumentDraft(selectedArgument))
    setEditorMessage('')
  }, [selectedArgument])

  const openInvite = () => {
    setInviteOpen(true)
    setInviteMessage('')
  }

  const closeInvite = () => {
    setInviteOpen(false)
    setInviteMessage('')
    setInviteEmail('')
  }

  const createInvite = (event) => {
    event.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteMessage('Enter a valid email address first.')
      return
    }

    const name = nameFromEmail(email)
    setMembers((current) => {
      if (current.some((member) => member.email === email)) return current
      return [
        {
          email,
          initials: getInitials(name),
          name,
          role: inviteRole,
          status: 'Invited',
          tone: 'amber',
        },
        ...current,
      ]
    })
    setInviteMessage(`Invite created for ${email}. They now appear as pending in the member list.`)
    setInviteEmail('')
  }

  const copyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}/signup?workspace=debate-room`
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setInviteMessage('Workspace invite link copied.')
    } catch {
      setInviteMessage(inviteUrl)
    }
  }

  const saveEditorDraft = () => {
    setEditorMessage('Collaborative draft saved locally.')
  }

  return (
    <div className="product-page team-page">
      <PageHeading
        title="Squad sync"
        description="Build cases together, review evidence, and watch the shared argument mutate in real time."
        action={<button className="product-button primary" type="button" onClick={openInvite}><Plus size={17} /> Invite member</button>}
      />

      <section className="team-metric-strip">
        <div><Users size={19} /><span>Members</span><strong>{members.length}</strong></div>
        <div><FileText size={19} /><span>Shared arguments</span><strong>32</strong></div>
        <div><MessageSquareText size={19} /><span>Current topic</span><strong>AI Regulation</strong></div>
        <div className="collab-pulse"><i /><span>{ACTIVITY[activityIndex]}</span></div>
      </section>

      <section className="team-workspace-grid">
        <article className="product-panel team-members-panel">
          <PanelHeading title="Members" meta={`${members.length} total`} />
          <div className="team-member-list">
            {members.map((member) => (
              <div key={member.email || member.name}>
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
          {editorOpen && (
            <div className="collaborative-editor" aria-label="Collaborative argument editor">
              <label>
                Shared draft
                <textarea
                  value={editorContent}
                  onChange={(event) => setEditorContent(event.target.value)}
                  rows={7}
                />
              </label>
              <div className="collaborative-editor-actions">
                <button className="product-button secondary" type="button" onClick={() => setEditorOpen(false)}>
                  <X size={16} />
                  Close
                </button>
                <button className="product-button primary" type="button" onClick={saveEditorDraft}>
                  <Save size={16} />
                  Save draft
                </button>
              </div>
              {editorMessage && <p className="team-action-status">{editorMessage}</p>}
            </div>
          )}
          <button className="panel-action" type="button" onClick={() => setEditorOpen((current) => !current)}>
            {editorOpen ? 'Hide collaborative editor' : 'Open collaborative editor'} <ArrowRight size={15} />
          </button>
        </article>
      </section>

      {inviteOpen && (
        <div className="team-modal-backdrop" role="presentation" onMouseDown={closeInvite}>
          <section
            aria-label="Invite member"
            aria-modal="true"
            className="team-modal"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <span><Mail size={18} /> Squad invite</span>
              <button type="button" aria-label="Close invite dialog" onClick={closeInvite}>
                <X size={18} />
              </button>
            </header>
            <form className="team-invite-form" onSubmit={createInvite}>
              <label>
                Email address
                <input
                  autoFocus
                  placeholder="teammate@example.com"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
              </label>
              <label>
                Role
                <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                  <option>Debater</option>
                  <option>Researcher</option>
                  <option>Coach</option>
                  <option>Speaker</option>
                </select>
              </label>
              <div className="team-invite-actions">
                <button className="product-button secondary" type="button" onClick={copyInviteLink}>
                  <Copy size={16} />
                  Copy link
                </button>
                <button className="product-button primary" type="submit">
                  <Plus size={16} />
                  Create invite
                </button>
              </div>
              {inviteMessage && <p className="team-action-status">{inviteMessage}</p>}
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function buildArgumentDraft(argument) {
  return `${argument.title}\n\nA risk-based regulatory model preserves room for low-risk innovation while requiring independent accountability for systems that affect employment, healthcare, education, and public safety.\n\nReview focus:\n- Define the risk tier clearly.\n- Add one source for public-safety impact.\n- Prepare a rebuttal to compliance-cost objections.`
}

function nameFromEmail(email) {
  return email
    .split('@')[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ') || 'Invited Member'
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'IM'
}

export default TeamPage
