import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import { LogOut, Menu, ShieldCheck, UserRound, X } from 'lucide-react'
import { useRole } from '../context/RoleContext'

const adminOnlyPaths = ['/expenses', '/vendors', '/analytics', '/flow', '/settings']

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, role, isAdmin, logout } = useRole()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
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

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  return (
    <div className="flex h-screen overflow-hidden bg-[#F3F4F6] dark:bg-gray-900">
      <Sidebar className="hidden lg:flex" />
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Workspace navigation">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 flex h-full">
            <Sidebar className="h-full" onNavigate={() => setMobileNavOpen(false)} />
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setMobileNavOpen(false)}
              className="ml-3 mt-3 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/95 text-slate-700 shadow-md"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="min-h-14 shrink-0 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-gray-700 dark:bg-gray-800 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Open navigation"
                onClick={() => setMobileNavOpen(true)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-[#1E3A8A] shadow-sm lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <span className="block truncate font-heading text-xs font-semibold uppercase tracking-[0.12em] text-[#1E3A8A]">{workspace.name}</span>
                <span className="block truncate text-xs font-medium text-[#6B7280] dark:text-slate-300">{workspace.description}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs sm:flex">
              {role === 'admin' ? <ShieldCheck className="h-3.5 w-3.5 text-[#1E3A8A]" /> : <UserRound className="h-3.5 w-3.5 text-[#1E3A8A]" />}
              <div>
                <p className="max-w-[160px] truncate font-semibold text-[#1E3A8A] lg:max-w-[220px]">{user?.name || user?.email}</p>
                <p className="capitalize text-slate-500">{role}</p>
              </div>
            </div>
            <button type="button" onClick={logout} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:flex sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
            <div className="hidden items-center gap-2 text-xs text-[#6B7280] xl:flex"><span className="h-2 w-2 rounded-full bg-[#10B981]" />All systems operational</div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
