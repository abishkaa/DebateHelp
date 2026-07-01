export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : '/api')

export function buildApiUrl(path) {
  return `${API_BASE_URL}${path}`
}

export function networkErrorMessage(service = 'server') {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Check your connection and try again.'
  }

  if (!import.meta.env.PROD && API_BASE_URL === '/api') {
    return 'Cannot reach the DebateHelp backend. Start the backend server on http://localhost:8001, then try again.'
  }

  return `Cannot reach the DebateHelp ${service}. Please refresh and try again.`
}
