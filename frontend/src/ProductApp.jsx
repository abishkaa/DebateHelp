import { useCallback, useEffect } from 'react'
import ProductShell from './components/product/ProductShell.jsx'
import { reportTemplate } from './data/productData.js'
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
  const handleExport = useCallback((customReport = reportTemplate) => {
    exportDebateReport(customReport)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [currentPath])

  let page = <OverviewPage currentUser={currentUser} navigateTo={navigateTo} onExport={handleExport} token={token} />
  if (currentPath.startsWith('/app/analyze')) page = <AnalyzePage onExport={handleExport} token={token} />
  if (currentPath.startsWith('/app/live')) page = <LiveDebatePage token={token} />
  if (currentPath.startsWith('/app/history')) page = <HistoryPage navigateTo={navigateTo} token={token} />
  if (currentPath.startsWith('/app/team')) page = <TeamPage />
  if (currentPath.startsWith('/app/reports')) page = <ReportsPage onExport={handleExport} />
  if (currentPath.startsWith('/app/profile')) {
    page = <ProfilePage currentUser={currentUser} updateProfile={updateProfile} />
  }

  return (
    <ProductShell
      currentPath={currentPath}
      currentUser={currentUser}
      navigateTo={navigateTo}
      onExport={handleExport}
      onLogout={onLogout}
    >
      {page}
    </ProductShell>
  )
}

export default ProductApp
