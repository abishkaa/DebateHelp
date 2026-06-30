import { useMemo, useState } from 'react'
import AuthFormInput from '../components/AuthFormInput.jsx'
import AuthLayout from '../components/AuthLayout.jsx'
import { useAuth } from '../context/AuthContext.jsx'

function VerifyEmail({ navigateTo }) {
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const { user, verifyEmail } = useAuth()
  const [email] = useState(query.get('email') || user?.email || '')
  const [token, setToken] = useState(query.get('token') || '')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!token.trim()) {
      setError('Paste the verification token from your email.')
      return
    }

    setLoading(true)
    setError('')
    setMessage('')
    try {
      await verifyEmail({ token: token.trim() })
      setMessage('Email verified. Let us personalize your workspace.')
      setTimeout(() => navigateTo('/register'), 700)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Verify Operator Channel"
      subtitle="Confirm ownership before opening your DebateHelp vault."
      variant="signup"
      footer={<button type="button" onClick={() => navigateTo('/login')}>Use another account</button>}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-alert error">{error}</div>}
        {message && <div className="auth-alert success">{message}</div>}

        <div className="auth-note">
          We sent a verification link to <strong>{email || 'your email'}</strong>. In development, the backend also logs the link in the terminal.
        </div>

        <AuthFormInput
          label="Verification token"
          name="token"
          placeholder="Paste verification token"
          value={token}
          onChange={(event) => setToken(event.target.value)}
        />

        <button className="auth-submit" disabled={loading} type="submit">
          {loading ? 'Verifying...' : 'Open vault'}
        </button>
      </form>
    </AuthLayout>
  )
}

export default VerifyEmail
