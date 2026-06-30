import { useCallback, useEffect, useState } from 'react'
import ProductApp from './ProductApp.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import LandingPage from './pages/LandingPage.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Signup from './pages/Signup.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'

const PUBLIC_AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/verify-email']
const PUBLIC_ROUTES = ['/', ...PUBLIC_AUTH_ROUTES]

function navigateTo(path, options = {}) {
  const method = options.replace ? 'replaceState' : 'pushState'
  window.history[method]({}, '', path)
  window.dispatchEvent(new Event('popstate'))
}

function useCurrentRoute() {
  const [route, setRoute] = useState(() => `${window.location.pathname}${window.location.search}`)

  useEffect(() => {
    const handleRouteChange = () => {
      setRoute(`${window.location.pathname}${window.location.search}`)
    }

    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [])

  return route
}

function AuthLoadingScreen() {
  return (
    <main className="auth-shell loading">
      <section className="auth-card">
        <div className="auth-loading-dot" aria-hidden="true" />
        <h1>Opening DebateHelp</h1>
        <p>Checking your session.</p>
      </section>
    </main>
  )
}

function AppRouter() {
  const route = useCurrentRoute()
  const path = window.location.pathname
  const { loading, logout, token, updateProfile, user } = useAuth()

  const goTo = useCallback((nextPath, options) => {
    navigateTo(nextPath, options)
  }, [])

  const handleLogout = useCallback(async () => {
    await logout()
    goTo('/login', { replace: true })
  }, [goTo, logout])

  useEffect(() => {
    if (loading) return

    if (!user && !PUBLIC_ROUTES.includes(path)) {
      goTo('/login', { replace: true })
      return
    }

    if (user && !user.profile_completed && path !== '/register') {
      goTo('/register', { replace: true })
      return
    }

    if (
      user?.profile_completed
      && (path === '/' || PUBLIC_AUTH_ROUTES.includes(path) || path === '/register')
    ) {
      goTo('/app', { replace: true })
    }
  }, [goTo, loading, path, route, user])

  if (loading) return <AuthLoadingScreen />

  if (!user) {
    if (path === '/') return <LandingPage navigateTo={goTo} />
    if (path === '/signup') return <Signup navigateTo={goTo} />
    if (path === '/forgot-password') return <ForgotPassword navigateTo={goTo} />
    if (path === '/verify-email') return <VerifyEmail navigateTo={goTo} />
    return <Login navigateTo={goTo} />
  }

  if (!user.profile_completed) return <Register navigateTo={goTo} />

  return (
    <ProductApp
      currentPath={route}
      currentUser={user}
      navigateTo={goTo}
      onLogout={handleLogout}
      token={token}
      updateProfile={updateProfile}
    />
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}

export default App
