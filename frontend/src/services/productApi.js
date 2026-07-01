const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:8001')

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.detail || 'Unable to load product data.')
  }
  return data
}

export const productApi = {
  dashboard() {
    return request('/product/dashboard')
  },
  sessions() {
    return request('/product/sessions')
  },
  team() {
    return request('/product/team')
  },
  inviteTeamMember(invite) {
    return request('/product/team/invites', {
      method: 'POST',
      body: invite,
    })
  },
}
