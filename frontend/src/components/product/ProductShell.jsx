import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  BarChart3,
  Command,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic2,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
  Zap,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
  { label: 'Analyze', path: '/app/analyze', icon: Activity, shortcut: 'A' },
  { label: 'Live debate', path: '/app/live', icon: Mic2 },
  { label: 'Archive', path: '/app/history', icon: History, shortcut: 'H' },
  { label: 'Squad', path: '/app/team', icon: Users },
  { label: 'Reports', path: '/app/reports', icon: FileText, shortcut: 'E' },
  { label: 'Profile', path: '/app/profile', icon: UserRound },
]

const COMMANDS = [
  { label: 'Analyze argument', detail: 'Open the argument analysis workspace', path: '/app/analyze', icon: Activity },
  { label: 'New session', detail: 'Start a fresh argument analysis', path: '/app/analyze?new=1', icon: Zap },
  { label: 'Open archives', detail: 'Review previous debates and growth', path: '/app/history', icon: History },
  { label: 'Start live debate', detail: 'Launch real-time coaching', path: '/app/live', icon: Mic2 },
  { label: 'Export dossier', detail: 'Generate the current professional PDF', action: 'export', icon: FileText },
  { label: 'Open team', detail: 'Review shared arguments', path: '/app/team', icon: Users },
]

function pathIsActive(currentPath, itemPath) {
  if (itemPath === '/app') {
    return currentPath === '/app'
  }
  return currentPath.startsWith(itemPath)
}

function ProductShell({
  children,
  currentPath,
  currentUser,
  navigateTo,
  onExport,
  onLogout,
}) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target
      const isTyping = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target?.isContentEditable

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((current) => !current)
        return
      }

      if (isTyping || event.ctrlKey || event.metaKey || event.altKey) {
        return
      }

      const key = event.key.toLowerCase()
      if (key === 'a') navigateTo('/app/analyze')
      if (key === 'e') onExport()
      if (key === 'n') navigateTo('/app/analyze?new=1')
      if (key === 'h') navigateTo('/app/history')
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateTo, onExport])

  const runCommand = (command) => {
    setPaletteOpen(false)
    setMobileMenuOpen(false)
    if (command.action === 'export') {
      onExport()
      return
    }
    navigateTo(command.path)
  }

  return (
    <div className="product-shell">
      <aside className={`product-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <button
          className="product-mobile-close"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
        >
          <X size={18} />
        </button>

        <button className="product-brand" type="button" onClick={() => navigateTo('/app')}>
          <span className="product-brand-mark"><Command size={20} /></span>
          <span>
            <strong>DebateHelp</strong>
            <small>Debate workspace</small>
          </span>
        </button>

        <div className="product-operator-card">
          <span>Current workspace</span>
          <strong>Debate room</strong>
          <small>Strategy mode active</small>
        </div>

        <nav className="product-nav" aria-label="Product navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = pathIsActive(currentPath, item.path)
            return (
              <button
                className={active ? 'active' : ''}
                key={item.path}
                type="button"
                onClick={() => runCommand(item)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.shortcut && <kbd>{item.shortcut}</kbd>}
              </button>
            )
          })}
        </nav>

        <div className="product-system-status">
          <p>System status</p>
          <div><span>API</span><strong><i /> Online</strong></div>
          <div><span>Reasoning</span><strong>Active</strong></div>
          <div><span>Workspace</span><strong>Synced</strong></div>
        </div>

        <button className="product-war-start" type="button" onClick={() => navigateTo('/app/analyze?new=1')}>
          New debate
        </button>

        <button className="product-account" type="button" onClick={() => navigateTo('/app/profile')}>
          {currentUser?.profile_image_url ? (
            <img
              className="product-avatar image"
              alt={`${currentUser.full_name || 'User'} profile`}
              src={currentUser.profile_image_url}
            />
          ) : (
            <span className="product-avatar">{getInitials(currentUser?.full_name)}</span>
          )}
          <span>
            <strong>{currentUser?.full_name || 'Abish Abdikalikov'}</strong>
            <small>{currentUser?.role || 'Debater'}</small>
          </span>
          <ShieldCheck size={16} />
        </button>
      </aside>

      {mobileMenuOpen && (
        <button
          className="product-mobile-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="product-main">
        <header className="product-topbar">
          <button
            className="product-menu-button"
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={20} />
          </button>

          <button className="product-command-trigger" type="button" onClick={() => setPaletteOpen(true)}>
            <Search size={18} />
            <span>Search tools, sessions, reports...</span>
            <kbd>Ctrl K</kbd>
          </button>

          <div className="product-hud-tabs" aria-label="War Room status">
            <span>Sessions</span>
            <span>Sources</span>
            <span>Coaching</span>
            <span>Reports</span>
          </div>

          <div className="product-top-actions">
            <span className="product-live-state"><i /> 00:42:18:08</span>
            <button type="button" title="AI coach" onClick={() => navigateTo('/app/analyze')}>
              <Sparkles size={18} />
            </button>
            <button type="button" title="Log out" onClick={onLogout}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="product-content">
          {children}
        </main>
      </div>

      <nav className="product-mobile-tabs" aria-label="Mobile product navigation">
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon
          return (
            <button
              className={pathIsActive(currentPath, item.path) ? 'active' : ''}
              key={item.path}
              type="button"
              onClick={() => navigateTo(item.path)}
            >
              <Icon size={18} />
              <span>{item.label.replace(' Debate', '')}</span>
            </button>
          )
        })}
      </nav>

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onSelect={runCommand}
        />
      )}
    </div>
  )
}

function CommandPalette({ onClose, onSelect }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return COMMANDS
    return COMMANDS.filter((command) => (
      `${command.label} ${command.detail}`.toLowerCase().includes(normalized)
    ))
  }, [query])

  useEffect(() => {
    inputRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Enter' && filtered[0]) onSelect(filtered[0])
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filtered, onClose, onSelect])

  return (
    <div className="command-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-search">
          <Search size={19} />
          <input
            ref={inputRef}
            aria-label="Search commands"
            placeholder="Search anything..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-list">
          {filtered.length > 0 ? filtered.map((command, index) => {
            const Icon = command.icon
            return (
              <button
                className={index === 0 ? 'selected' : ''}
                key={command.label}
                type="button"
                onClick={() => onSelect(command)}
              >
                <span><Icon size={18} /></span>
                <span>
                  <strong>{command.label}</strong>
                  <small>{command.detail}</small>
                </span>
              </button>
            )
          }) : (
            <div className="command-empty">No matching commands.</div>
          )}
        </div>
        <footer>
          <span><kbd>A</kbd> Analyze</span>
          <span><kbd>E</kbd> Export</span>
          <span><kbd>N</kbd> New session</span>
          <span><kbd>H</kbd> History</span>
        </footer>
      </section>
    </div>
  )
}

function getInitials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'AA'
}

export default ProductShell
