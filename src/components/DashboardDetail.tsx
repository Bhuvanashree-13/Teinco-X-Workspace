import { useEffect, useMemo, useState } from 'react'
import { X, Search, ArrowDownToLine, Receipt } from 'lucide-react'
import { useApi, formatCurrency, formatDate } from '../hooks/useApi'
import { Skeleton } from './Skeleton'

export type DashboardDetailTarget = { metric: string; title: string; subtitle: string; accent: string; value: number; categoryId?: number | null }

type DetailRow = { kind: 'expense' | 'deposit'; id: number; ref: string; date: string; description: string; party: string | null; category: string; color: string; frequency: string | null; amount: number }
type DetailResponse = { metric: string; asOf: string; truncated: boolean; rows: DetailRow[] }

export default function DashboardDetail({ target, onClose, onOpen }: { target: DashboardDetailTarget; onClose: () => void; onOpen: (path: string) => void }) {
  const query = new URLSearchParams({ metric: target.metric })
  if (target.categoryId != null) query.set('categoryId', String(target.categoryId))
  const { data, loading, error, refetch } = useApi<DetailResponse>(`/dashboard/details?${query}`)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const rows = data?.rows || []
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(row => [row.ref, row.description, row.party, row.category].some(value => value?.toLowerCase().includes(term)))
  }, [rows, search])

  const expenseTotal = filtered.filter(row => row.kind === 'expense').reduce((total, row) => total + row.amount, 0)
  const depositTotal = filtered.filter(row => row.kind === 'deposit').reduce((total, row) => total + row.amount, 0)
  const hasDeposits = rows.some(row => row.kind === 'deposit')
  const hasExpenses = rows.some(row => row.kind === 'expense')

  const byCategory = useMemo(() => {
    const totals = new Map<string, { name: string; color: string; amount: number; count: number }>()
    for (const row of filtered) {
      if (row.kind !== 'expense') continue
      const entry = totals.get(row.category) || { name: row.category, color: row.color, amount: 0, count: 0 }
      entry.amount += row.amount
      entry.count += 1
      totals.set(row.category, entry)
    }
    return [...totals.values()].sort((a, b) => b.amount - a.amount)
  }, [filtered])

  const byMonth = useMemo(() => {
    const totals = new Map<string, { label: string; amount: number; count: number }>()
    for (const row of filtered) {
      const date = new Date(row.date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const entry = totals.get(key) || { label: date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }), amount: 0, count: 0 }
      entry.amount += row.kind === 'deposit' ? row.amount : -row.amount
      entry.count += 1
      totals.set(key, entry)
    }
    return [...totals.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([, entry]) => entry)
  }, [filtered])
  const categoryTotal = byCategory.reduce((total, category) => total + category.amount, 0) || 1

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="dashboard-detail-title">
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" />
      <div className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-gray-900" style={{ borderTop: `4px solid ${target.accent}` }}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-gray-700">
          <div className="min-w-0">
            <p className="brand-label">{target.subtitle}</p>
            <h3 id="dashboard-detail-title" className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{target.title}</h3>
            <p className="finance-value mt-1 text-2xl font-semibold" style={{ color: target.accent }}>{formatCurrency(target.value)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-800" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {loading && <div className="space-y-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}
          {error && <div role="alert" className="text-sm text-red-600 dark:text-red-300">Could not load details. <button type="button" onClick={() => void refetch()} className="underline">Try again</button></div>}
          {!loading && !error && <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-gray-800"><p className="text-xs text-slate-500">Records</p><p className="mt-1 font-semibold text-slate-900 dark:text-white">{filtered.length}{data?.truncated ? '+' : ''}</p></div>
              {hasExpenses && <div className="rounded-xl bg-slate-50 p-3 dark:bg-gray-800"><p className="text-xs text-slate-500">Expenses</p><p className="finance-value mt-1 font-semibold text-slate-900 dark:text-white">{formatCurrency(expenseTotal)}</p></div>}
              {hasDeposits && <div className="rounded-xl bg-slate-50 p-3 dark:bg-gray-800"><p className="text-xs text-slate-500">Deposits</p><p className="finance-value mt-1 font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(depositTotal)}</p></div>}
            </div>
            {data?.truncated && <p className="text-xs text-amber-700">Showing the most recent 2,000 records. Open the full list for everything.</p>}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search description, vendor, category or ID" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
            </div>

            {byCategory.length > 1 && <section>
              <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">By category</h4>
              <div className="space-y-2">{byCategory.map(category => <div key={category.name}>
                <div className="flex justify-between gap-3 text-xs"><span className="text-slate-600 dark:text-slate-300">{category.name} · {category.count}</span><span className="finance-value font-medium text-slate-900 dark:text-white">{formatCurrency(category.amount)}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700"><div className="h-full rounded-full" style={{ width: `${Math.max(0, category.amount / categoryTotal * 100)}%`, backgroundColor: category.color }} /></div>
              </div>)}</div>
            </section>}

            {byMonth.length > 1 && <section>
              <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">By month</h4>
              <div className="flex gap-2 overflow-x-auto pb-1">{byMonth.map(month => <div key={month.label} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 dark:border-gray-700"><p className="text-xs text-slate-500">{month.label} · {month.count}</p><p className="finance-value text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(Math.abs(month.amount))}</p></div>)}</div>
            </section>}

            <section>
              <h4 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Transactions</h4>
              <div className="divide-y divide-slate-100 dark:divide-gray-800">
                {filtered.map(row => <div key={`${row.kind}-${row.id}`} className="flex items-center gap-3 py-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${row.color}1A`, color: row.color }}>{row.kind === 'deposit' ? <ArrowDownToLine className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{row.description}</p>
                    <p className="truncate text-xs text-slate-500">{row.ref} · {formatDate(row.date)} · {row.party || 'No vendor'}{row.kind === 'expense' ? ` · ${row.category}` : ''}{row.frequency ? ` · ${row.frequency}` : ''}</p>
                  </div>
                  <p className={`finance-value shrink-0 text-sm font-semibold ${row.kind === 'deposit' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>{row.kind === 'deposit' ? '+' : '−'}{formatCurrency(row.amount)}</p>
                </div>)}
                {!filtered.length && <p className="py-10 text-center text-sm text-slate-500">{search ? 'No records match your search.' : 'No records behind this figure yet.'}</p>}
              </div>
            </section>
          </>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4 dark:border-gray-700">
          {hasDeposits && <button type="button" onClick={() => onOpen('/deposits')} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-gray-700 dark:text-slate-200">Open deposits</button>}
          {(hasExpenses || !hasDeposits) && <button type="button" onClick={() => onOpen('/expenses')} className="rounded-lg bg-[#315CF3] px-3 py-2 text-sm font-medium text-white">Open expenses</button>}
        </div>
      </div>
    </div>
  )
}
