import { useState } from 'react'
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
import { prepareProfileImage, PROFILE_IMAGE_HELP } from '../../utils/profileImage.js'
import { PanelHeading, PageHeading } from './OverviewPage.jsx'

function ProfilePage({ currentUser, updateProfile }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imageProcessing, setImageProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [imageMessage, setImageMessage] = useState('')
  const [form, setForm] = useState({
    full_name: currentUser?.full_name || 'Abish Abdikalikov',
    role: currentUser?.role || 'Debater',
    debate_level: currentUser?.debate_level || 'Advanced',
    preferred_debate_format: currentUser?.preferred_debate_format || 'Parliamentary',
    main_interests: currentUser?.main_interests || 'AI policy, public speaking, evidence analysis',
    organization: currentUser?.organization || 'DebateHelp',
    profile_image_url: currentUser?.profile_image_url || '',
  })
  const initials = getInitials(form.full_name)

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
          <p>{form.role} - {form.debate_level} - {form.organization}</p>
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
        {progressMetrics.slice(0, 3).map((metric) => (
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
          <PanelHeading title="Strength profile" meta="Based on 47 debates" />
          <div className="profile-strength-grid">
            <div className="positive"><CheckCircle2 size={19} /><span><strong>Logic</strong><small>Coherent argument structure</small></span></div>
            <div className="positive"><CheckCircle2 size={19} /><span><strong>Rebuttals</strong><small>Strong counter-position coverage</small></span></div>
            <div className="contested"><Circle size={19} /><span><strong>Evidence</strong><small>Needs more primary sources</small></span></div>
            <div className="contested"><Circle size={19} /><span><strong>Cross-examination</strong><small>Ask more diagnostic questions</small></span></div>
          </div>
        </article>
      </section>

      <section className="product-panel profile-achievements">
        <PanelHeading title="Professional milestones" meta="2 earned - 1 in progress" />
        <div>
          {achievements.map((achievement) => (
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
