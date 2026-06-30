import { useMemo, useRef, useState } from 'react'
import AuthFormInput from '../components/AuthFormInput.jsx'
import AuthLayout from '../components/AuthLayout.jsx'
import OAuthButtons from '../components/OAuthButtons.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const INITIAL_FORM = {
  email: '',
  password: '',
  remember: true,
}

function Login({ navigateTo }) {
  const { login, oauthLogin } = useAuth()
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const emailRef = useRef(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState(() => {
    const oauthError = query.get('oauth_error')
    return oauthError ? { form: oauthError } : {}
  })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState('')

  const updateField = (event) => {
    const { checked, name, type, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
    setErrors((current) => ({ ...current, [name]: '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validateLogin(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const response = await login(form)
      setMessage('Welcome back. Opening your workspace...')
      routeAfterAuth(response.user, navigateTo)
    } catch (err) {
      setErrors({ form: err.message })
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
      title="Sign in"
      subtitle="Access your debate workspace."
      variant="login"
      footer={(
        <>
          New here? <button type="button" onClick={() => navigateTo('/signup')}>Create operator</button>
        </>
      )}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {errors.form && <div className="auth-alert error">{errors.form}</div>}
        {message && <div className="auth-alert success">{message}</div>}

        <AuthFormInput
          autoComplete="email"
          error={errors.email}
          inputRef={emailRef}
          label="Email"
          name="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={updateField}
        />
        <AuthFormInput
          autoComplete="current-password"
          error={errors.password}
          label="Password"
          name="password"
          placeholder="Your password"
          type="password"
          value={form.password}
          onChange={updateField}
        />

        <div className="auth-row">
          <label className="auth-checkbox">
            <input
              checked={form.remember}
              name="remember"
              type="checkbox"
              onChange={updateField}
            />
            Remember me
          </label>
          <button className="auth-link" type="button" onClick={() => navigateTo('/forgot-password')}>
            Forgot password?
          </button>
        </div>

        <button className="auth-submit" disabled={loading} type="submit">
          {loading ? 'Connecting...' : 'Sign in'}
        </button>
      </form>

      <div className="auth-divider"><span>OR</span></div>

      <OAuthButtons
        loadingProvider={loadingProvider}
        onEmail={() => emailRef.current?.focus()}
        onProvider={handleOAuth}
        showEmail={false}
      />
    </AuthLayout>
  )
}

function validateLogin(form) {
  const errors = {}
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (!form.password) {
    errors.password = 'Enter your password.'
  }
  return errors
}

export function routeAfterAuth(user, navigateTo) {
  if (!user.profile_completed) {
    navigateTo('/register')
    return
  }

  navigateTo('/app')
}

export default Login
