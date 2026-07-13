export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : '/api')
const DEFAULT_TIMEOUT_MS = Number.parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '30000', 10)
const API_TIMEOUT_MS = Number.isFinite(DEFAULT_TIMEOUT_MS) && DEFAULT_TIMEOUT_MS > 0
  ? DEFAULT_TIMEOUT_MS
  : 30000
const CSRF_COOKIE_NAME = import.meta.env.VITE_CSRF_COOKIE_NAME || 'debatehelp_csrf'
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function buildApiUrl(path) {
  const normalizedPath = path?.startsWith('/') ? path : `/${path || ''}`

  if (!API_BASE_URL) return normalizedPath

  return `${API_BASE_URL.replace(/\/+$/, '')}${normalizedPath}`
}

export async function apiFetch(path, options = {}) {
  const { timeoutMs = API_TIMEOUT_MS, ...fetchOptions } = options
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const method = String(fetchOptions.method || 'GET').toUpperCase()
  const headers = new Headers(fetchOptions.headers || {})
  const csrfToken = UNSAFE_METHODS.has(method) ? readCookie(CSRF_COOKIE_NAME) : ''

  if (csrfToken && !headers.has(CSRF_HEADER_NAME)) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }

  try {
    return await fetch(buildApiUrl(path), {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

function readCookie(name) {
  if (typeof document === 'undefined') return ''
  const prefix = `${encodeURIComponent(name)}=`
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))

  if (!cookie) return ''

  try {
    return decodeURIComponent(cookie.slice(prefix.length))
  } catch {
    return ''
  }
}

export function networkErrorMessage(service = 'server', error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Check your connection and try again.'
  }

  if (error?.name === 'AbortError') {
    return `The DebateHelp ${service} took too long to respond. Try again in a moment.`
  }

  if (!import.meta.env.PROD && API_BASE_URL === '/api') {
    return 'Cannot reach the DebateHelp backend. Restart the frontend dev server; it now auto-starts FastAPI on http://localhost:8001.'
  }

  return `Cannot reach the DebateHelp ${service}. Please refresh and try again.`
}
