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
import { productApi } from '../../services/productApi.js'
import { PanelHeading, PageHeading } from './OverviewPage.jsx'

function TeamPage({ currentUser, token }) {
  const [activityIndex, setActivityIndex] = useState(0)
  const [members, setMembers] = useState(() => (currentUser ? [buildCurrentMember(currentUser)] : []))
  const [syncingMembers, setSyncingMembers] = useState(Boolean(token))
  const [sharedArgumentItems, setSharedArgumentItems] = useState([])
  const [selectedArgument, setSelectedArgument] = useState(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Debater')
  const [inviteSaving, setInviteSaving] = useState(false)
  const [inviteMessage, setInviteMessage] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorContent, setEditorContent] = useState(() => buildArgumentDraft(null))
  const [editorMessage, setEditorMessage] = useState('')
  const currentUserName = currentUser?.full_name || currentUser?.email || 'You'
  const invitedCount = members.filter((member) => member.status === 'Invited').length
  const activityMessages = [
    syncingMembers ? 'Syncing real team members...' : `${currentUserName} is active in the workspace`,
    sharedArgumentItems.length
      ? `${sharedArgumentItems.length} shared draft${sharedArgumentItems.length === 1 ? '' : 's'} saved locally`
      : 'No shared arguments yet',
    invitedCount
      ? `${invitedCount} invited member${invitedCount === 1 ? '' : 's'} pending`
      : 'Invite members when you are ready',
  ]

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActivityIndex((current) => current + 1)
    }, 2800)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!currentUser) return
    const currentMember = buildCurrentMember(currentUser)
    setMembers((current) => [
      currentMember,
      ...current.filter((member) => !member.is_current && member.email !== currentMember.email),
    ])
  }, [currentUser])

  useEffect(() => {
    let active = true
    if (!token) {
      setSyncingMembers(false)
      return undefined
    }

    setSyncingMembers(true)
    productApi.team()
      .then((data) => {
        if (!active) return
        setMembers(data.members || [])
      })
      .catch((error) => {
        if (active) setInviteMessage(error.message || 'Unable to load real team members.')
      })
      .finally(() => {
        if (active) setSyncingMembers(false)
      })

    return () => {
      active = false
    }
  }, [token])

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

  const createInvite = async (event) => {
    event.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteMessage('Enter a valid email address first.')
      return
    }
    if (currentUser?.email && email === currentUser.email.toLowerCase()) {
      setInviteMessage('You are already a member of this workspace.')
      return
    }

    setInviteSaving(true)
    setInviteMessage('')
    try {
      const data = await productApi.inviteTeamMember({ email, role: inviteRole })
      setMembers(data.members || [])
      setInviteMessage(`Invite saved for ${email}. It is now part of your real team data.`)
      setInviteEmail('')
    } catch (error) {
      setInviteMessage(error.message || 'Unable to save this invite.')
    } finally {
      setInviteSaving(false)
    }
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
    const trimmed = editorContent.trim()
    if (!trimmed) {
      setEditorMessage('Write a draft before saving.')
      return
    }

    const [firstLine] = trimmed.split('\n')
    const draft = {
      title: firstLine.trim() || 'Untitled shared argument',
      owner: currentUserName.split(/\s+/)[0] || 'You',
      quality: 0,
      citations: 0,
      status: 'Draft',
      body: trimmed,
    }

    setSharedArgumentItems((current) => {
      const withoutCurrent = selectedArgument
        ? current.filter((argument) => argument.title !== selectedArgument.title)
        : current
      return [draft, ...withoutCurrent]
    })
    setSelectedArgument(draft)
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
        <div><FileText size={19} /><span>Shared arguments</span><strong>{sharedArgumentItems.length}</strong></div>
        <div><MessageSquareText size={19} /><span>Current topic</span><strong>{selectedArgument?.title || 'No topic yet'}</strong></div>
        <div className="collab-pulse"><i /><span>{activityMessages[activityIndex % activityMessages.length]}</span></div>
      </section>

      <section className="team-workspace-grid">
        <article className="product-panel team-members-panel">
          <PanelHeading title="Members" meta={syncingMembers ? 'Syncing...' : `${members.length} total`} />
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
          <PanelHeading title="Shared arguments" meta={`${sharedArgumentItems.length} saved`} />
          <div className="shared-argument-list">
            {sharedArgumentItems.length ? (
              sharedArgumentItems.map((argument) => (
                <button
                  className={selectedArgument?.title === argument.title ? 'selected' : ''}
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
              ))
            ) : (
              <div className="panel-empty-state compact">
                <strong>No shared arguments yet.</strong>
                <p>Create a draft in the editor and it will appear here.</p>
                <button type="button" onClick={() => setEditorOpen(true)}>
                  Create first draft <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        </article>

        <article className="product-panel team-review-panel">
          <PanelHeading title="Argument review" meta={selectedArgument ? 'Local draft' : 'No draft selected'} />
          <div className="live-editing-line"><i /> {selectedArgument ? 'Draft ready for review.' : 'No teammate activity yet.'}</div>
          <h3>{selectedArgument?.title || 'No shared argument yet'}</h3>
          <p>{selectedArgument?.body || 'Open the collaborative editor to create the first shared argument for this workspace.'}</p>
          <div className="review-notes">
            <div><CheckCircle2 size={17} /><span><strong>Saved drafts</strong><small>{sharedArgumentItems.length} real shared draft{sharedArgumentItems.length === 1 ? '' : 's'} in this workspace.</small></span></div>
            <div><MessageSquareText size={17} /><span><strong>Team notes</strong><small>Invite members to add collaborative feedback.</small></span></div>
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
                <button className="product-button primary" disabled={inviteSaving} type="submit">
                  <Plus size={16} />
                  {inviteSaving ? 'Saving...' : 'Create invite'}
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
  if (argument?.body) return argument.body
  if (argument?.title) return `${argument.title}\n\n`
  return 'Untitled shared argument\n\nWrite your collaborative claim here.\n\nReview focus:\n- Add the warrant.\n- Add one source.\n- Prepare one rebuttal.'
}

function buildCurrentMember(currentUser) {
  const name = currentUser.full_name || currentUser.email || 'Current User'
  return {
    email: currentUser.email || 'current-user',
    initials: getInitials(name),
    is_current: true,
    name,
    role: currentUser.role || 'Workspace owner',
    status: 'Active',
    tone: 'green',
  }
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
