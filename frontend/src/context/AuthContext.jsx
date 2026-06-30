import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authApi, clearLegacyTokens } from '../services/authApi.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadUser() {
      clearLegacyTokens()
      try {
        const currentUser = await authApi.me()
        if (active) {
          setUser(currentUser)
        }
      } catch {
        if (active) {
          setUser(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadUser()
    return () => {
      active = false
    }
  }, [])

  const acceptAuthResponse = useCallback((response) => {
    setUser(response.user)
    return response
  }, [])

  const signup = useCallback(async (payload) => {
    const response = await authApi.signup(payload)
    return acceptAuthResponse(response)
  }, [acceptAuthResponse])

  const login = useCallback(async (payload) => {
    const response = await authApi.login(payload)
    return acceptAuthResponse(response)
  }, [acceptAuthResponse])

  const verifyEmail = useCallback(async (payload) => {
    const response = await authApi.verifyEmail(payload)
    return acceptAuthResponse(response)
  }, [acceptAuthResponse])

  const forgotPassword = useCallback((payload) => authApi.forgotPassword(payload), [])
  const resetPassword = useCallback((payload) => authApi.resetPassword(payload), [])

  const updateProfile = useCallback(async (payload) => {
    const updatedUser = await authApi.updateProfile(payload)
    setUser(updatedUser)
    return updatedUser
  }, [])

  const oauthLogin = useCallback((provider) => {
    authApi.startOAuth(provider)
  }, [])

  const logout = useCallback(async () => {
    setUser(null)
    await authApi.logout().catch(() => null)
  }, [])

  const value = useMemo(() => ({
    token: user ? 'cookie-session' : null,
    user,
    loading,
    signup,
    login,
    logout,
    verifyEmail,
    forgotPassword,
    resetPassword,
    updateProfile,
    oauthLogin,
  }), [
    forgotPassword,
    loading,
    login,
    logout,
    oauthLogin,
    resetPassword,
    signup,
    updateProfile,
    user,
    verifyEmail,
  ])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}
