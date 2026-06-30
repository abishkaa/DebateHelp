const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:8001')
const LOCAL_TOKEN_KEY = 'debate_auth_token'
const SESSION_TOKEN_KEY = 'debate_auth_session_token'

export function clearLegacyTokens() {
  localStorage.removeItem(LOCAL_TOKEN_KEY)
  sessionStorage.removeItem(SESSION_TOKEN_KEY)
}

function oauthStartUrl(provider) {
  const nextPath = window.location.pathname === '/signup' ? '/signup' : '/login'
  const query = new URLSearchParams({ next: nextPath })
  return `${API_BASE_URL}/auth/oauth/${encodeURIComponent(provider)}/start?${query.toString()}`
}

function errorMessage(data, fallback) {
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail) && data.detail[0]?.message) return data.detail[0].message
  return data.message || fallback
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(errorMessage(data, 'Something went wrong. Please try again.'))
  }

  return data
}

export const authApi = {
  signup(payload) {
    return request('/auth/signup', { method: 'POST', body: payload })
  },
  login(payload) {
    return request('/auth/login', { method: 'POST', body: payload })
  },
  logout() {
    return request('/auth/logout', { method: 'POST' })
  },
  me() {
    return request('/auth/me')
  },
  updateProfile(payload) {
    return request('/auth/profile', { method: 'POST', body: payload })
  },
  forgotPassword(payload) {
    return request('/auth/forgot-password', { method: 'POST', body: payload })
  },
  resetPassword(payload) {
    return request('/auth/reset-password', { method: 'POST', body: payload })
  },
  verifyEmail(payload) {
    return request('/auth/verify-email', { method: 'POST', body: payload })
  },
  startOAuth(provider) {
    window.location.assign(oauthStartUrl(provider))
  },
}
