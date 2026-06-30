import { useState } from 'react'
import AuthLayout from '../components/AuthLayout.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { prepareProfileImage, PROFILE_IMAGE_HELP } from '../utils/profileImage.js'

const ROLE_OPTIONS = ['Student', 'Debater', 'Teacher', 'Researcher', 'Coach', 'Other']
const LEVEL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced', 'Varsity', 'Coach']
const FORMAT_OPTIONS = ['Policy', 'Parliamentary', 'Lincoln-Douglas', 'Public Forum', 'World Schools', 'Other']
const USE_CASE_OPTIONS = ['School', 'MUN', 'University', 'Research', 'Public Speaking']

function Register({ navigateTo }) {
  const { updateProfile, user } = useAuth()
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    role: user?.role || 'Student',
    purpose: user?.purpose || '',
    debate_level: user?.debate_level || 'Intermediate',
    preferred_debate_format: user?.preferred_debate_format || 'Parliamentary',
    main_interests: user?.main_interests || '',
    organization: user?.organization || '',
    profile_image_url: user?.profile_image_url || '',
    use_case: 'School',
  })
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState('')
  const [imageProcessing, setImageProcessing] = useState(false)
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleProfileImageChange = async (event) => {
    const input = event.currentTarget
    const [file] = input.files || []
    if (!file) return

    setImageError('')
    setImageProcessing(true)
    try {
      const profileImage = await prepareProfileImage(file)
      setForm((current) => ({ ...current, profile_image_url: profileImage }))
    } catch (err) {
      setImageError(err.message)
      input.value = ''
    } finally {
      setImageProcessing(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (form.full_name.trim().length < 2) {
      setError('Enter your full name before continuing.')
      return
    }
    if (imageProcessing) {
      setError('Wait a second — your profile image is still being prepared.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const { use_case: useCase, ...profile } = form
      await updateProfile({
        ...profile,
        purpose: profile.purpose || `Primary use: ${useCase}`,
      })
      setSuccess('Profile saved. Opening your DebateHelp workspace...')
      navigateTo('/app')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Configure the Vault"
      subtitle="Personalize DebateHelp before you enter."
      variant="setup"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-alert error">{error}</div>}
        {success && <div className="auth-alert success">{success}</div>}

        <fieldset className="onboarding-choice-group">
          <legend>What are you using DebateHelp for?</legend>
          <div>
            {USE_CASE_OPTIONS.map((option) => (
              <label className={form.use_case === option ? 'selected' : ''} key={option}>
                <input
                  checked={form.use_case === option}
                  name="use_case"
                  type="radio"
                  value={option}
                  onChange={updateField}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="auth-field">
          <span>Full name</span>
          <input name="full_name" value={form.full_name} onChange={updateField} />
        </label>

        <div className="auth-two-column">
          <label className="auth-field">
            <span>Role</span>
            <select name="role" value={form.role} onChange={updateField}>
              {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label className="auth-field">
            <span>Debate level</span>
            <select name="debate_level" value={form.debate_level} onChange={updateField}>
              {LEVEL_OPTIONS.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
        </div>

        <label className="auth-field">
          <span>Preferred debate format</span>
          <select name="preferred_debate_format" value={form.preferred_debate_format} onChange={updateField}>
            {FORMAT_OPTIONS.map((format) => <option key={format} value={format}>{format}</option>)}
          </select>
        </label>

        <label className="auth-field">
          <span>Main interests</span>
          <textarea
            name="main_interests"
            placeholder="AI policy, public speaking, economics, climate debate..."
            rows={3}
            value={form.main_interests}
            onChange={updateField}
          />
        </label>

        <label className="auth-field">
          <span>Organization / school</span>
          <input
            name="organization"
            placeholder="Optional"
            value={form.organization}
            onChange={updateField}
          />
        </label>

        <div className="auth-upload">
          <span>Profile image</span>
          {form.profile_image_url && (
            <div className="auth-upload-preview">
              <img alt="Profile preview" src={form.profile_image_url} />
              <button
                type="button"
                onClick={() => {
                  setForm((current) => ({ ...current, profile_image_url: '' }))
                  setImageError('')
                }}
              >
                Remove
              </button>
            </div>
          )}
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label="Profile image"
            disabled={loading || imageProcessing}
            type="file"
            onChange={handleProfileImageChange}
          />
          <em>{imageProcessing ? 'Preparing image...' : PROFILE_IMAGE_HELP}</em>
          {imageError && <small className="auth-upload-error">{imageError}</small>}
        </div>

        <button className="auth-submit" disabled={loading || imageProcessing} type="submit">
          {loading ? 'Saving profile...' : 'Finish setup'}
        </button>
      </form>
    </AuthLayout>
  )
}

export default Register
