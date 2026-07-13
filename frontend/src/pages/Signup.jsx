import { useMemo, useRef, useState } from 'react'
import AuthFormInput from '../components/AuthFormInput.jsx'
import AuthLayout from '../components/AuthLayout.jsx'
import OAuthButtons from '../components/OAuthButtons.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { routeAfterAuth } from './Login.jsx'

const ROLE_OPTIONS = ['Student', 'Debater', 'Teacher', 'Researcher', 'Coach', 'Other']

const INITIAL_FORM = {
  full_name: '',
  email: '',
  password: '',
  confirm_password: '',
  role: 'Student',
  purpose: '',
}

function Signup({ navigateTo }) {
  const { oauthLogin, signup } = useAuth()
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const nameRef = useRef(null)
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    email: query.get('email') || '',
  }))
  const [errors, setErrors] = useState(() => {
    const oauthError = query.get('oauth_error')
    return oauthError ? { form: oauthError } : {}
  })
  const [loading, setLoading] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState('')

  const updateField = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validateSignup(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setLoading(true)
    try {
      const response = await signup(form)
      routeAfterAuth(response.user, navigateTo)
    } catch (err) {
      setErrors({ form: normalizeSignupError(err.message) })
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = (provider) => {
    setLoadingProvider(provider)
    setErrors({})
    try {
      oauthLogin(provider)
    } catch (err) {
      setErrors({ form: err.message })
      setLoadingProvider('')
    }
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Build your debate vault and start training."
      variant="signup"
      footer={(
        <>
          Already have an account? <button type="button" onClick={() => navigateTo('/login')}>Log in</button>
        </>
      )}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {errors.form && (
          <div className="auth-alert error">
            <span>{errors.form}</span>
            {isExistingAccountError(errors.form) && (
              <div className="auth-alert-actions">
                <button type="button" onClick={() => navigateTo('/login')}>
                  Log in
                </button>
                <button type="button" onClick={() => navigateTo(`/forgot-password?email=${encodeURIComponent(form.email.trim())}`)}>
                  Reset password
                </button>
              </div>
            )}
          </div>
        )}

        <AuthFormInput
          autoComplete="name"
          error={errors.full_name}
          inputRef={nameRef}
          label="Full name"
          name="full_name"
          placeholder="Your full name"
          value={form.full_name}
          onChange={updateField}
        />
        <AuthFormInput
          autoComplete="email"
          error={errors.email}
          label="Email"
          name="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={updateField}
        />
        <AuthFormInput
          autoComplete="new-password"
          error={errors.password}
          label="Password"
          name="password"
          placeholder="At least 8 characters"
          type="password"
          value={form.password}
          onChange={updateField}
        />
        <AuthFormInput
          autoComplete="new-password"
          error={errors.confirm_password}
          label="Confirm password"
          name="confirm_password"
          placeholder="Repeat your password"
          type="password"
          value={form.confirm_password}
          onChange={updateField}
        />

        <label className="auth-field">
          <span>Role / purpose</span>
          <select name="role" value={form.role} onChange={updateField}>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </label>

        <label className="auth-field">
          <span>Purpose</span>
          <textarea
            name="purpose"
            placeholder="What do you want DebateHelp to help you improve?"
            rows={3}
            value={form.purpose}
            onChange={updateField}
          />
        </label>

        <button className="auth-submit" disabled={loading} type="submit">
          {loading ? 'Creating operator...' : 'Create operator'}
        </button>
      </form>

      <div className="auth-divider"><span>or continue with</span></div>

      <OAuthButtons
        loadingProvider={loadingProvider}
        onEmail={() => nameRef.current?.focus()}
        onProvider={handleOAuth}
        showEmail={false}
      />
    </AuthLayout>
  )
}

function validateSignup(form) {
  const errors = {}
  if (form.full_name.trim().length < 2) {
    errors.full_name = 'Enter your full name.'
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (form.password.length < 8) {
    errors.password = 'Use at least 8 characters.'
  } else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
    errors.password = 'Use at least one letter and one number.'
  }
  if (form.confirm_password !== form.password) {
    errors.confirm_password = 'Passwords do not match.'
  }
  return errors
}

function normalizeSignupError(message = '') {
  if (message.includes('Unable to create an account with those details')) {
    return 'Unable to create an account with those details. Check your information or try signing in.'
  }
  return message || 'Unable to create an account. Please check your details and try again.'
}

function isExistingAccountError(message = '') {
  return false
}

export default Signup
