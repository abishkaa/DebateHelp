import { useEffect, useMemo, useState } from 'react'
import {
  Award,
  Check,
  CheckCircle2,
  Circle,
  Edit3,
  Save,
  Target,
  TrendingUp,
} from 'lucide-react'
import { achievements, progressMetrics } from '../../data/productData.js'
import { productApi } from '../../services/productApi.js'
import { prepareProfileImage, PROFILE_IMAGE_HELP } from '../../utils/profileImage.js'
import { PanelHeading, PageHeading } from './OverviewPage.jsx'

function ProfilePage({ currentUser, token, updateProfile }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imageProcessing, setImageProcessing] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [syncingStats, setSyncingStats] = useState(Boolean(token))
  const [message, setMessage] = useState('')
  const [imageMessage, setImageMessage] = useState('')
  const [form, setForm] = useState({
    full_name: currentUser?.full_name || currentUser?.email || 'DebateHelp User',
    role: currentUser?.role || 'Debater',
    debate_level: currentUser?.debate_level || 'Beginner',
    preferred_debate_format: currentUser?.preferred_debate_format || 'Parliamentary',
    main_interests: currentUser?.main_interests || '',
    organization: currentUser?.organization || '',
    profile_image_url: currentUser?.profile_image_url || '',
  })
  const initials = getInitials(form.full_name)
  const metrics = dashboard?.metrics?.length ? dashboard.metrics.slice(0, 3) : progressMetrics.slice(0, 3)
  const achievementData = dashboard?.achievements?.length ? dashboard.achievements : achievements
  const earnedCount = achievementData.filter((achievement) => achievement.status === 'Earned').length
  const debateCount = Number.parseInt(
    metrics.find((metric) => metric.label === 'Debates completed')?.value?.replace(/,/g, '') || '0',
    10,
  ) || 0
  const latestSession = dashboard?.recent_sessions?.[0]
  const profileSubtitle = [form.role, form.debate_level, form.organization].filter(Boolean).join(' - ')
  const strengthItems = useMemo(() => {
    if (!latestSession) {
      return [
        { tone: 'contested', icon: <Circle size={19} />, label: 'No real sessions yet', detail: 'Analyze an argument to build a strength profile.' },
      ]
    }

    return [
      { tone: 'positive', icon: <CheckCircle2 size={19} />, label: 'Latest session', detail: `${latestSession.title} scored ${latestSession.score}%.` },
      { tone: 'positive', icon: <CheckCircle2 size={19} />, label: 'Tracked practice', detail: `${debateCount} real session${debateCount === 1 ? '' : 's'} recorded.` },
      { tone: 'contested', icon: <Circle size={19} />, label: 'Next revision', detail: 'Open the report to refine claims, evidence, and rebuttals.' },
    ]
  }, [debateCount, latestSession])

  useEffect(() => {
    let active = true
    if (!token) {
      setSyncingStats(false)
      return undefined
    }

    productApi.dashboard(token)
      .then((data) => {
        if (active) setDashboard(data)
      })
      .catch(() => null)
      .finally(() => {
        if (active) setSyncingStats(false)
      })

    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    if (editing || !currentUser) return
    setForm({
      full_name: currentUser.full_name || currentUser.email || 'DebateHelp User',
      role: currentUser.role || 'Debater',
      debate_level: currentUser.debate_level || 'Beginner',
      preferred_debate_format: currentUser.preferred_debate_format || 'Parliamentary',
      main_interests: currentUser.main_interests || '',
      organization: currentUser.organization || '',
      profile_image_url: currentUser.profile_image_url || '',
    })
  }, [currentUser, editing])

  const handleProfileImageChange = async (event) => {
    const input = event.currentTarget
    const [file] = input.files || []
    if (!file) return

    setImageMessage('')
    setImageProcessing(true)
    try {
      const profileImage = await prepareProfileImage(file)
      setForm((current) => ({ ...current, profile_image_url: profileImage }))
      setImageMessage('Image ready. Save profile to keep it.')
    } catch (error) {
      setImageMessage(error.message)
      input.value = ''
    } finally {
      setImageProcessing(false)
    }
  }

  const saveProfile = async () => {
    if (imageProcessing) {
      setMessage('Wait a second — your profile image is still being prepared.')
      return
    }

    setSaving(true)
    setMessage('')
    try {
      await updateProfile(form)
      setEditing(false)
      setMessage('Profile updated.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="product-page profile-page">
      <PageHeading
        title="Profile"
        description="Your debate identity, learning trajectory, saved sessions, and milestones."
        action={(
          <button className="product-button secondary" type="button" onClick={() => editing ? saveProfile() : setEditing(true)}>
            {editing ? <Save size={17} /> : <Edit3 size={17} />}
            {editing ? (saving ? 'Saving...' : 'Save profile') : 'Edit profile'}
          </button>
        )}
      />

      {message && <div className="profile-message">{message}</div>}

      <section className="profile-identity">
        {form.profile_image_url ? (
          <img className="profile-large-avatar image" alt={`${form.full_name || 'User'} profile`} src={form.profile_image_url} />
        ) : (
          <span className="profile-large-avatar">{initials}</span>
        )}
        <div>
          {editing ? (
            <input
              aria-label="Full name"
              value={form.full_name}
              onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
            />
          ) : <h2>{form.full_name}</h2>}
          <p>{profileSubtitle || 'Profile details not set yet'}</p>
          <span><i /> Progress tracking active</span>
          {editing && (
            <label className="profile-image-control">
              <strong>Profile image</strong>
              <input
                accept="image/jpeg,image/png,image/webp"
                disabled={saving || imageProcessing}
                type="file"
                onChange={handleProfileImageChange}
              />
              <small>{imageProcessing ? 'Preparing image...' : (imageMessage || PROFILE_IMAGE_HELP)}</small>
            </label>
          )}
        </div>
      </section>

      <section className="profile-stat-grid">
        {metrics.map((metric) => (
          <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.change}</small></article>
        ))}
      </section>

      <section className="profile-layout">
        <article className="product-panel profile-details">
          <PanelHeading title="Learning profile" />
          <ProfileField
            editing={editing}
            label="Debate level"
            value={form.debate_level}
            onChange={(value) => setForm((current) => ({ ...current, debate_level: value }))}
          />
          <ProfileField
            editing={editing}
            label="Preferred format"
            value={form.preferred_debate_format}
            onChange={(value) => setForm((current) => ({ ...current, preferred_debate_format: value }))}
          />
          <ProfileField
            editing={editing}
            label="Organization"
            value={form.organization}
            onChange={(value) => setForm((current) => ({ ...current, organization: value }))}
          />
          <ProfileField
            editing={editing}
            label="Main interests"
            value={form.main_interests}
            onChange={(value) => setForm((current) => ({ ...current, main_interests: value }))}
          />
        </article>

        <article className="product-panel profile-strengths">
          <PanelHeading
            title="Strength profile"
            meta={syncingStats ? 'Syncing real data' : `Based on ${debateCount} real session${debateCount === 1 ? '' : 's'}`}
          />
          <div className="profile-strength-grid">
            {strengthItems.map((item) => (
              <div className={item.tone} key={item.label}>
                {item.icon}
                <span><strong>{item.label}</strong><small>{item.detail}</small></span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="product-panel profile-achievements">
        <PanelHeading title="Professional milestones" meta={`${earnedCount} earned - ${achievementData.length - earnedCount} in progress`} />
        <div>
          {achievementData.map((achievement) => (
            <article key={achievement.title}>
              <span className={`achievement-symbol ${achievement.tone}`}><Award size={22} /></span>
              <div>
                <h3>{achievement.title}</h3>
                <p>{achievement.description}</p>
                <progress
                  aria-label={`${achievement.title} progress`}
                  className="score-progress"
                  max="100"
                  value={achievement.progress}
                />
              </div>
              <strong>{achievement.status === 'Earned' ? <Check size={16} /> : <TrendingUp size={16} />}{achievement.status}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function ProfileField({ editing, label, onChange, value }) {
  return (
    <label>
      <span>{label}</span>
      {editing ? <input value={value} onChange={(event) => onChange(event.target.value)} /> : <strong>{value}</strong>}
    </label>
  )
}

export default ProfilePage

function getInitials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'AA'
}
