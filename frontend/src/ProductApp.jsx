import { useCallback, useEffect } from 'react'
import ProductShell from './components/product/ProductShell.jsx'
import AnalyzePage from './pages/product/AnalyzePage.jsx'
import HistoryPage from './pages/product/HistoryPage.jsx'
import LiveDebatePage from './pages/product/LiveDebatePage.jsx'
import OverviewPage from './pages/product/OverviewPage.jsx'
import ProfilePage from './pages/product/ProfilePage.jsx'
import ReportsPage from './pages/product/ReportsPage.jsx'
import TeamPage from './pages/product/TeamPage.jsx'
import { exportDebateReport } from './utils/reportExport.js'

function ProductApp({
  currentPath,
  currentUser,
  navigateTo,
  onLogout,
  token,
  updateProfile,
}) {
  const handleExport = useCallback((customReport) => {
    if (!customReport || customReport?.nativeEvent) return
    exportDebateReport(customReport)
  }, [])
  const openReportExporter = useCallback(() => {
    navigateTo('/app/reports')
  }, [navigateTo])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [currentPath])

  let page = <OverviewPage currentUser={currentUser} navigateTo={navigateTo} onExport={handleExport} token={token} />
  if (currentPath.startsWith('/app/analyze')) page = <AnalyzePage currentPath={currentPath} onExport={handleExport} token={token} />
  if (currentPath.startsWith('/app/live')) page = <LiveDebatePage currentPath={currentPath} currentUser={currentUser} token={token} />
  if (currentPath.startsWith('/app/history')) page = <HistoryPage currentPath={currentPath} navigateTo={navigateTo} token={token} />
  if (currentPath.startsWith('/app/team')) page = <TeamPage currentUser={currentUser} token={token} />
  if (currentPath.startsWith('/app/reports')) page = <ReportsPage currentPath={currentPath} onExport={handleExport} token={token} />
  if (currentPath.startsWith('/app/profile')) {
    page = <ProfilePage currentUser={currentUser} token={token} updateProfile={updateProfile} />
  }

  return (
    <ProductShell
      currentPath={currentPath}
      currentUser={currentUser}
      navigateTo={navigateTo}
      onExport={openReportExporter}
      onLogout={onLogout}
    >
      {page}
    </ProductShell>
  )
}

export default ProductApp
