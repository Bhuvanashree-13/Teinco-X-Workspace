import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, Receipt, Store, Calendar, CalendarDays,
  BarChart3, Settings, Users, Network, FileText, Landmark, FolderKanban
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
  { to: '/projects', icon: FolderKanban, label: 'Projects & Taskboard' },
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
    : navItems.filter(item => ['/', '/subscriptions', '/projects', '/people', '/payslips', '/schedule'].includes(item.to))

  return (
    <aside className={`workspace-sidebar w-[272px] max-w-[86vw] text-white flex flex-col shrink-0 ${className}`}>
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex min-h-8 items-center min-w-[140px]">
          <img src="/teinco-logo.png" alt="Teinco.ai" className="h-10 w-auto rounded bg-white px-2 py-1 object-contain" />
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="w-full flex items-center justify-between rounded-lg bg-white/10 border border-white/10 px-3 py-2.5 text-left">
          <span className="flex items-center gap-2.5"><Network className="w-4 h-4 text-[#60A5FA]" strokeWidth={1.5} /><span><span className="block text-xs font-semibold">Teinco-X Workspace</span><span className="block text-[10px] text-white/70 capitalize">{role} mode</span></span></span>
        </div>
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
                  ? 'bg-white/[0.16] text-white shadow-[inset_3px_0_0_#AFC0FF,0_8px_20px_rgba(20,38,110,0.15)]'
                  : 'text-white/80 hover:bg-white/[0.07] hover:text-white'
              }`
            }
          >
            <item.icon className="w-4 h-4" strokeWidth={1.5} />
            {item.label}
          </NavLink>
        ))}

        <p className="px-3 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">{isAdmin ? 'Admin workspace' : 'Employee workspace'}</p>
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-white/70 space-y-1">
          <p className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            Workspace data
          </p>
          <p>Stored on your workspace server</p>
        </div>
      </div>
    </aside>
  )
}

