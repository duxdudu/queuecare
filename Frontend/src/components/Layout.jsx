import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { apiFetch } from '../lib/api'

/**
 * Layout wraps every protected page.
 * Props:
 *   title       — page title shown in the top header
 *   action      — optional { label, to?, onClick?, testId?, variant? }
 *                 renders ONE button/link in the header (no duplication)
 *   children    — page body
 */
function Layout({ title, action, children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isStaff = user?.role === 'staff'

  async function handleLogout() {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }) } catch { /* ignore */ }
    logout()
    navigate('/login')
  }

  // Nav items — role-aware
  const navItems = [
    { label: 'Dashboard',      icon: '🏠', to: '/dashboard' },
    { label: "Today's Queue",  icon: '📋', to: '/queue' },
    // Patients only
    ...(!isStaff ? [{ label: 'New Appointment', icon: '➕', to: '/appointments/new', testId: 'create-appointment-btn' }] : []),
  ]

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <div className="app-shell">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <h2>🏥 QueueCare</h2>
          <p>Clinic Management</p>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Menu</div>
          {navItems.map(item => {
            const isActive = location.pathname === item.to ||
              (item.to !== '/dashboard' && location.pathname.startsWith(item.to))
            return (
              <Link
                key={item.to}
                to={item.to}
                data-testid={item.testId}
                className={`sidebar-link${isActive ? ' active' : ''}`}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User + logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
          </div>
          <button
            className="sidebar-logout"
            data-testid="logout-btn"
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="main-area">

        {/* Top header — title + ONE action only */}
        <header className="top-header">
          <span className="top-header-title">{title}</span>
          {action && (
            <div className="top-header-action">
              {action.to ? (
                <Link
                  to={action.to}
                  data-testid={action.testId}
                  className={`btn ${action.variant || 'btn-primary'}`}
                >
                  {action.label}
                </Link>
              ) : (
                <button
                  onClick={action.onClick}
                  data-testid={action.testId}
                  className={`btn ${action.variant || 'btn-primary'}`}
                >
                  {action.label}
                </button>
              )}
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
