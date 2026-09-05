import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Sidebar from './Sidebar'
import CommandPalette from './CommandPalette'
import { LogOut, Menu, Moon, Search, ShieldCheck, Sun, UserRound, X } from 'lucide-react'
import { useRole } from '../context/RoleContext'
import { useTheme } from '../hooks/useTheme'

const adminOnlyPaths = ['/expenses', '/vendors', '/analytics', '/flow', '/settings']

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, role, isAdmin, logout } = useRole()
  const { resolvedTheme, toggle } = useTheme()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
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
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(current => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
                <span className="block truncate font-heading text-xs font-semibold uppercase tracking-[0.12em] text-[#1E3A8A] dark:text-blue-300">{workspace.name}</span>
                <span className="block truncate text-xs font-medium text-[#6B7280] dark:text-slate-300">{workspace.description}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 shadow-sm transition-colors hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-300 dark:hover:bg-gray-700 sm:flex"
                aria-label="Quick navigation"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search</span>
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-400 dark:border-gray-600 dark:bg-gray-700 dark:text-slate-400">
                  {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'}
                </kbd>
              </button>
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm sm:hidden"
                aria-label="Quick navigation"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggle}
                className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-amber-300 dark:hover:bg-gray-700"
                aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs sm:flex dark:border-gray-700 dark:bg-gray-800">
              {role === 'admin' ? <ShieldCheck className="h-3.5 w-3.5 text-[#1E3A8A] dark:text-blue-300" /> : <UserRound className="h-3.5 w-3.5 text-[#1E3A8A] dark:text-blue-300" />}
              <div>
                <p className="max-w-[160px] truncate font-semibold text-[#1E3A8A] lg:max-w-[220px] dark:text-white">{user?.name || user?.email}</p>
                <p className="capitalize text-slate-500 dark:text-slate-400">{role}</p>
              </div>
            </div>
            <button type="button" onClick={logout} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-slate-300 dark:hover:bg-gray-700 sm:flex sm:w-auto sm:gap-1.5 sm:px-3 sm:py-2">
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
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
