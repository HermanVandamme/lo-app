import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/',          label: 'Sporten',   icon: '🏅' },
  { to: '/evaluatie', label: 'Evaluatie', icon: '📋' },
  { to: '/admin',     label: 'Admin',     icon: '⚙️' },
]

export default function NavBar() {
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-50 safe-top" style={{ background: '#2C3E50' }}>
      <div className="container mx-auto px-4 max-w-3xl flex items-center justify-between h-14">
        <Link to="/" className="text-white font-bold text-lg tracking-tight">
          LO MASTER <span className="text-brand text-sm font-normal">2026</span>
        </Link>
        <nav className="flex gap-1">
          {NAV_ITEMS.map(({ to, label, icon }) => {
            const active = pathname === to || (to !== '/' && pathname.startsWith(to))
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center px-3 py-1 rounded-lg text-xs font-medium transition-colors min-w-[52px]
                  ${active ? 'bg-brand text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
              >
                <span className="text-base leading-tight">{icon}</span>
                <span>{label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
