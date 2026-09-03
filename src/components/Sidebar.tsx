import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, Receipt, Store, Calendar, CalendarDays,
  BarChart3, Settings, Users, Network, ChevronDown, FileText, Landmark
} from 'lucide-react'
import { useRole } from '../context/RoleContext'

type SidebarProps = {
  className?: string
  onNavigate?: () => void
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/deposits', icon: Landmark, label: 'Deposits' },
  { to: '/vendors', icon: Store, label: 'Vendors' },
  { to: '/subscriptions', icon: Calendar, label: 'Subscriptions' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/people', icon: Users, label: 'People' },
  { to: '/payslips', icon: FileText, label: 'Payslips' },
  { to: '/schedule', icon: CalendarDays, label: 'Schedule' },
  { to: '/flow', icon: Network, label: 'Flow' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar({ className = '', onNavigate }: SidebarProps) {
  const { role, isAdmin } = useRole()
  const visibleNavItems = isAdmin
    ? navItems
    : navItems.filter(item => ['/', '/subscriptions', '/people', '/payslips', '/schedule'].includes(item.to))

  return (
    <aside className={`w-[272px] max-w-[86vw] bg-[#1E3A8A] text-white flex flex-col shrink-0 shadow-[1px_0_3px_rgba(17,24,39,0.12)] ${className}`}>
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex min-h-8 items-center min-w-[140px]">
          <img src="/teinco-logo.png" alt="Teinco.ai" className="h-10 w-auto object-contain" />
        </div>
      </div>

      <div className="px-4 pt-4">
        <button className="w-full flex items-center justify-between rounded-lg bg-white/10 border border-white/10 px-3 py-2.5 text-left">
          <span className="flex items-center gap-2.5"><Network className="w-4 h-4 text-[#60A5FA]" strokeWidth={1.5} /><span><span className="block text-xs font-semibold">Teinco-X Workspace</span><span className="block text-[10px] text-white/70 capitalize">{role} mode</span></span></span>
          <ChevronDown className="w-3.5 h-3.5 text-white/70" />
        </button>
      </div>

      <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Workspace navigation</p>
        {visibleNavItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white/[0.12] text-white shadow-[inset_3px_0_0_#60A5FA]'
                  : 'text-white/80 hover:bg-white/[0.07] hover:text-white'
              }`
            }
          >
            <item.icon className="w-4 h-4" strokeWidth={1.5} />
            {item.label}
          </NavLink>
        ))}

        <p className="px-3 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">{isAdmin ? 'All modules active' : 'Employee workspace'}</p>
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-white/70 space-y-1">
          <p className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            Data stored locally
          </p>
          <p>v1.0.0 • SQLite</p>
        </div>
      </div>
    </aside>
  )
}

