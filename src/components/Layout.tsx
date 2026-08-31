import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import { LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { useRole } from '../context/RoleContext'

const adminOnlyPaths = ['/expenses', '/vendors', '/analytics', '/flow', '/settings']

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, role, isAdmin, logout } = useRole()
  const isPeople = location.pathname.startsWith('/people')
  const isPayslips = location.pathname.startsWith('/payslips')
  const isSchedule = location.pathname.startsWith('/schedule')
  const isFlow = location.pathname.startsWith('/flow')
  const workspace = isPeople
    ? { name: 'Teinco-X People', description: 'Human resource management' }
    : isPayslips
      ? { name: 'Teinco-X People', description: 'Employee payslips and payroll records' }
      : isSchedule
      ? { name: 'Teinco-X Schedule', description: 'Calendar and milestone coordination' }
      : isFlow
        ? { name: 'Teinco-X Flow', description: 'ERP and operational intelligence' }
        : { name: 'Teinco-X Ledger', description: 'Business finance workspace' }

  useEffect(() => {
    if (!isAdmin && location.pathname.startsWith('/expenses')) {
      navigate('/subscriptions', { replace: true })
      return
    }
    if (!isAdmin && adminOnlyPaths.some(path => location.pathname.startsWith(path))) {
      navigate('/people', { replace: true })
    }
  }, [isAdmin, location.pathname, navigate])

  return (
    <div className="flex h-screen bg-[#F3F4F6] dark:bg-gray-900">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="h-14 shrink-0 border-b border-slate-200 bg-white/90 px-6 flex items-center justify-between backdrop-blur dark:border-gray-700 dark:bg-gray-800">
          <div><span className="font-heading text-xs font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">{workspace.name}</span><span className="mx-2 text-slate-300">/</span><span className="text-xs font-medium text-[#6B7280] dark:text-slate-300">{workspace.description}</span></div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
              {role === 'admin' ? <ShieldCheck className="h-3.5 w-3.5 text-[#1E3A8A]" /> : <UserRound className="h-3.5 w-3.5 text-[#1E3A8A]" />}
              <div>
                <p className="font-semibold text-[#1E3A8A]">{user?.name || user?.email}</p>
                <p className="capitalize text-slate-500">{role}</p>
              </div>
            </div>
            <button type="button" onClick={logout} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
            <div className="flex items-center gap-2 text-xs text-[#6B7280]"><span className="h-2 w-2 rounded-full bg-[#10B981]" />All systems operational</div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
