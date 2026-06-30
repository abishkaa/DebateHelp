import { useMemo, useState } from 'react'
import AuthFormInput from '../components/AuthFormInput.jsx'
import AuthLayout from '../components/AuthLayout.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function ForgotPassword({ navigateTo }) {
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const { forgotPassword, resetPassword } = useAuth()
  const [email, setEmail] = useState(query.get('email') || '')
  const [token, setToken] = useState(query.get('reset_token') || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const requestReset = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await forgotPassword({ email })
      setMessage(response.message)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const submitReset = async (event) => {
    event.preventDefault()
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await resetPassword({
        token,
        password,
        confirm_password: confirmPassword,
      })
      setMessage(response.message)
      setTimeout(() => navigateTo('/login'), 700)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Recover access and keep your debate archive moving."
      variant="login"
      footer={<button type="button" onClick={() => navigateTo('/login')}>Back to login</button>}
    >
      <form className="auth-form" onSubmit={requestReset}>
        {error && <div className="auth-alert error">{error}</div>}
        {message && <div className="auth-alert success">{message}</div>}
        <AuthFormInput
          autoComplete="email"
          label="Email"
          name="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button className="auth-submit" disabled={loading} type="submit">
          {loading ? 'Sending reset link...' : 'Send reset link'}
        </button>
      </form>

      <div className="auth-divider"><span>Have a reset token?</span></div>

      <form className="auth-form" onSubmit={submitReset}>
        <AuthFormInput
          label="Reset token"
          name="token"
          placeholder="Paste token from email"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />
        <AuthFormInput
          autoComplete="new-password"
          label="New password"
          name="password"
          placeholder="At least 8 characters"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <AuthFormInput
          autoComplete="new-password"
          label="Confirm new password"
          name="confirmPassword"
          placeholder="Repeat new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <button className="auth-submit bronze" disabled={loading || !token} type="submit">
          {loading ? 'Resetting...' : 'Reset password'}
        </button>
      </form>
    </AuthLayout>
  )
}

export default ForgotPassword
