const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:8001')

async function request(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
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
}
