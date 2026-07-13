import { apiFetch, networkErrorMessage } from './apiConfig.js'

async function request(path, options = {}) {
  let response
  try {
    response = await apiFetch(path, {
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include',
    })
  } catch (error) {
    throw new Error(networkErrorMessage('product server', error))
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const fallback = response.status >= 500
      ? networkErrorMessage('product server')
      : 'Unable to load product data.'
    throw new Error(data.detail || fallback)
  }
  return data
}

export const productApi = {
  health() {
    return request('/health/backend')
  },
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
  sharedArguments() {
    return request('/product/shared-arguments')
  },
  saveSharedArgument(argument) {
    return request('/product/shared-arguments', {
      method: 'POST',
      body: argument,
    })
  },
  createLiveRoom(payload) {
    return request('/product/live/rooms', {
      method: 'POST',
      body: payload,
    })
  },
  joinLiveRoom(roomCode) {
    return request('/product/live/rooms/join', {
      method: 'POST',
      body: { room_code: roomCode },
    })
  },
  liveRoom(roomCode) {
    return request(`/product/live/rooms/${encodeURIComponent(roomCode)}`)
  },
  startLiveRoom(roomCode) {
    return request(`/product/live/rooms/${encodeURIComponent(roomCode)}/start`, {
      method: 'POST',
      body: {},
    })
  },
  submitLiveStatement(roomCode, text) {
    return request(`/product/live/rooms/${encodeURIComponent(roomCode)}/statements`, {
      method: 'POST',
      body: { text },
    })
  },
  report(sessionId) {
    return request(`/product/reports/${encodeURIComponent(sessionId)}`)
  },
}
