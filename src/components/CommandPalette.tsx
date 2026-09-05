import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CalendarDays,
  FileText,
  Landmark,
  LayoutDashboard,
  LogOut,
  Monitor,
  Moon,
  Network,
  Plus,
  Receipt,
  Search,
  Settings,
  Store,
  Sun,
  Users,
  CornerDownLeft,
} from 'lucide-react'
import { useRole } from '../context/RoleContext'
import { useTheme, type ThemePreference } from '../hooks/useTheme'

type CommandPaletteProps = {
  open: boolean
  onClose: () => void
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', keywords: 'home overview kpi' },
  { to: '/expenses', icon: Receipt, label: 'Expenses', keywords: 'spend ledger transactions' },
  { to: '/deposits', icon: Landmark, label: 'Deposits', keywords: 'funds inflow balance' },
  { to: '/vendors', icon: Store, label: 'Vendors', keywords: 'suppliers directory' },
  { to: '/subscriptions', icon: Calendar, label: 'Subscriptions', keywords: 'recurring billing renewal' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics', keywords: 'charts insights reports' },
  { to: '/people', icon: Users, label: 'People', keywords: 'employees hr team' },
  { to: '/payslips', icon: FileText, label: 'Payslips', keywords: 'payroll salary' },
  { to: '/schedule', icon: CalendarDays, label: 'Schedule', keywords: 'calendar milestones' },
  { to: '/flow', icon: Network, label: 'Flow', keywords: 'erp operations' },
  { to: '/settings', icon: Settings, label: 'Settings', keywords: 'preferences configuration' },
]

const employeeOnly = ['/', '/subscriptions', '/people', '/payslips', '/schedule']

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { isAdmin, logout } = useRole()
  const { preference, resolvedTheme, setTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => {
    const nav = (isAdmin ? navItems : navItems.filter(item => employeeOnly.includes(item.to))).map(item => ({
      type: 'nav' as const,
      id: `nav:${item.to}`,
      label: item.label,
      keywords: item.keywords,
      icon: item.icon,
      run: () => navigate(item.to),
    }))

    const actions: Array<{ type: 'action'; id: string; label: string; keywords: string; icon: any; run: () => void }> = [
      ...(isAdmin ? [{ type: 'action' as const, id: 'action:new-expense', label: 'Record a new expense', keywords: 'add create transaction', icon: Plus, run: () => navigate('/expenses') }] : []),
      {
        type: 'action' as const,
        id: 'action:toggle-theme',
        label: resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
        keywords: 'theme dark light appearance',
        icon: resolvedTheme === 'dark' ? Sun : Moon,
        run: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
      },
      { type: 'action' as const, id: 'action:logout', label: 'Log out of workspace', keywords: 'sign out exit', icon: LogOut, run: logout },
    ]

    return [...nav, ...actions]
  }, [isAdmin, navigate, logout, resolvedTheme, setTheme])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return items
    return items.filter(item => {
      const haystack = `${item.label} ${item.keywords}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [items, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex(index => (filtered.length === 0 ? 0 : (index + 1) % filtered.length))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex(index => (filtered.length === 0 ? 0 : (index - 1 + filtered.length) % filtered.length))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        const item = filtered[activeIndex]
        if (item) {
          onClose()
          item.run()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, filtered, activeIndex, onClose])

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  const runItem = (index: number) => {
    const item = filtered[index]
    if (!item) return
    onClose()
    item.run()
  }

  const themeOptions: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-slate-950/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={() => onClose()}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 fade-in dark:border-gray-700 dark:bg-gray-800"
        onMouseDown={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick navigation"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 dark:border-gray-700">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search pages and actions…"
            className="w-full bg-transparent py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
          />
          <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-400 dark:border-gray-600 dark:bg-gray-700 dark:text-slate-300 sm:inline-block">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[46vh] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No matches for “{query}”</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Try a page name like “expenses” or an action like “record”.</p>
            </div>
          )}
          {filtered.map((item, index) => (
            <button
              key={item.id}
              type="button"
              data-index={index}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => runItem(index)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                index === activeIndex
                  ? 'bg-[#EFF6FF] text-[#1E3A8A] dark:bg-blue-950/50 dark:text-blue-300'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              <item.icon className={`h-4 w-4 shrink-0 ${index === activeIndex ? 'text-[#1E3A8A] dark:text-blue-300' : 'text-slate-400'}`} strokeWidth={1.5} />
              <span className="flex-1 truncate font-medium">{item.label}</span>
              {item.type === 'nav' && index === activeIndex && <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
              {item.type === 'action' && index === activeIndex && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-60" />}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-2.5 dark:border-gray-700">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-sans dark:border-gray-600 dark:bg-gray-700">↑</kbd><kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-sans dark:border-gray-600 dark:bg-gray-700">↓</kbd> navigate</span>
            <span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-sans dark:border-gray-600 dark:bg-gray-700">↵</kbd> open</span>
          </div>
          <div className="flex items-center gap-1.5">
            {themeOptions.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                  preference === option.value
                    ? 'bg-[#1E3A8A] text-white'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-gray-700'
                }`}
              >
                <option.icon className="h-3 w-3" />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}