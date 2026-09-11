import { useState } from 'react'
import { useApi, formatCurrency, formatDate } from '../hooks/useApi'
import { BarChart3, PieChart, Building2, ChevronRight, RefreshCw, X } from 'lucide-react'
import { ChartSkeleton } from './Skeleton'

type SpendRow = { key?: string; categoryId?: number | null; projectId?: number | null; category?: string; project?: string; vendor?: string; kind?: string; amount: number; transactions?: number; color?: string }
type SpendDetail = { id: number; expenseId: string; description: string; expenseDate: string; amount: number; baseAmount: number; gstAmount: number; vendor?: string | null; category?: string | null; project?: string | null }

function SpendList({ rows, title, onSelect }: { rows: SpendRow[]; title: string; onSelect: (row: SpendRow) => void }) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  return <section className="brand-card min-w-0 p-5 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h3 className="brand-section-heading">{title}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{rows.length} {rows.length === 1 ? 'group' : 'groups'} · amounts in INR</p></div>
      <p className="finance-value text-xl font-semibold text-slate-900 dark:text-white">{formatCurrency(total)}</p>
    </div>
    {!rows.length ? <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No spending recorded for this period.</p> : <ul className="divide-y divide-slate-100 dark:divide-gray-700">
      {rows.map((row, index) => {
        const share = total > 0 ? row.amount / total * 100 : null
        return <li key={row.key ?? row.categoryId ?? row.projectId ?? index} className="py-1 first:pt-0 last:pb-0"><button type="button" onClick={() => onSelect(row)} className="w-full rounded-lg px-2 py-3 text-left transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-gray-700">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0"><p className="break-words text-sm font-medium text-slate-800 dark:text-slate-100">{row.vendor || row.category || row.project}</p>{row.transactions !== undefined && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{row.transactions} {row.transactions === 1 ? 'transaction' : 'transactions'}</p>}</div>
            <div className="flex shrink-0 items-center gap-2 text-right"><span><span className="finance-value text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(row.amount)}</span><span className="ml-3 text-xs text-slate-500 dark:text-slate-400">{share === null ? '—' : `${share.toFixed(1)}%`}</span></span><ChevronRight className="h-4 w-4 text-slate-400" /></div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700" aria-hidden="true"><div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, share ?? 0))}%`, backgroundColor: row.color || '#60a5fa' }} /></div>
        </button></li>
      })}
    </ul>}
    {rows.some(row => row.amount < 0) && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Negative amounts are adjustments. Bars show positive shares of net spend.</p>}
  </section>
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('category')
  const [year, setYear] = useState(new Date().getFullYear())
  const [selected, setSelected] = useState<{ group: string; key: string; label: string } | null>(null)
  const tabs = [
    { id: 'category', label: 'By Category', icon: PieChart, endpoint: 'spend-by-category' },
    { id: 'vendor', label: 'By Vendor', icon: Building2, endpoint: 'spend-by-vendor' },
    { id: 'project', label: 'By Project', icon: BarChart3, endpoint: 'project-allocation' },
  ]
  const endpoint = tabs.find(tab => tab.id === activeTab)!.endpoint
  const { data, loading, error, refetch } = useApi<SpendRow[]>(`/analytics/${endpoint}?year=${year}`)
  const rows = [...(data || [])].sort((a, b) => b.amount - a.amount)
  const vendors = rows.filter(row => row.kind === 'vendor')
  const otherSpend = rows.filter(row => row.kind !== 'vendor')
  const selectRow = (row: SpendRow) => setSelected({ group: activeTab, key: activeTab === 'category' ? String(row.categoryId) : activeTab === 'project' ? (row.projectId == null ? 'unassigned' : String(row.projectId)) : String(row.key), label: row.category || row.project || row.vendor || 'Spending' })
  const details = useApi<SpendDetail[]>(selected ? `/analytics/spending-details?year=${year}&group=${selected.group}&key=${encodeURIComponent(selected.key)}` : null)
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="brand-heading">Spend Intelligence</h2><p className="brand-caption mt-1">{year === new Date().getFullYear() ? 'Year to date' : `Calendar year ${year}`} · active expenses · categories include subcategories</p></div>
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600 dark:text-slate-300">Year <select value={year} onChange={event => setYear(Number(event.target.value))} className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white">{Array.from({ length: 10 }, (_, index) => new Date().getFullYear() - index).map(value => <option key={value}>{value}</option>)}</select></label>
        <button type="button" onClick={() => void refetch()} disabled={loading} aria-label="Refresh analytics" className="rounded-lg border p-2 text-slate-600 disabled:opacity-50 dark:border-gray-600 dark:text-slate-300"><RefreshCw className="h-4 w-4" /></button>
      </div>
    </div>
    <div className="flex gap-2 overflow-x-auto border-b border-gray-200 pb-1 dark:border-gray-700">
      {tabs.map(tab => <button key={tab.id} type="button" aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${activeTab === tab.id ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300' : 'border-transparent text-slate-500 dark:text-slate-400'}`}><tab.icon className="h-4 w-4" />{tab.label}</button>)}
    </div>
    {loading ? <div className="brand-card p-6 dark:bg-gray-800"><ChartSkeleton /></div> : error ? <div role="alert" className="rounded-lg border border-red-200 p-5 text-red-700 dark:border-red-900 dark:text-red-300">Failed to load analytics. <button type="button" onClick={() => void refetch()} className="underline">Try again</button></div> : activeTab === 'vendor' ? <>
      <p className="text-sm text-slate-600 dark:text-slate-300">Total recorded spend: <strong className="finance-value text-slate-900 dark:text-white">{formatCurrency(rows.reduce((sum, row) => sum + row.amount, 0))}</strong>. Vendor rankings exclude payroll and expenses without a vendor.</p>
      <div className="grid items-start gap-6 lg:grid-cols-2"><SpendList rows={vendors} title="Vendor Spending" onSelect={selectRow} /><SpendList rows={otherSpend} title="Internal & Unassigned Spending" onSelect={selectRow} /></div>
    </> : <SpendList rows={rows} title={activeTab === 'category' ? 'Category Spending' : 'Project Allocation'} onSelect={selectRow} />}
    {selected && <section className="brand-card p-5 dark:border-gray-700 dark:bg-gray-800 sm:p-6"><div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="brand-section-heading">{selected.label} breakdown</h3><p className="mt-1 text-xs text-slate-500">Individual expenses contributing to this total</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Close breakdown" className="rounded-lg border p-2 dark:border-gray-600"><X className="h-4 w-4" /></button></div>{details.loading ? <ChartSkeleton /> : details.error ? <p role="alert" className="text-sm text-red-600">Could not load this breakdown.</p> : !details.data?.length ? <p className="py-6 text-center text-sm text-slate-500">No matching expenses.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500 dark:border-gray-700"><tr><th className="py-3 pr-4">Expense</th><th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Vendor / project</th><th className="py-3 text-right">Amount</th></tr></thead><tbody className="divide-y dark:divide-gray-700">{details.data.map(item => <tr key={item.id}><td className="py-3 pr-4"><p className="font-medium dark:text-white">{item.description}</p><p className="text-xs text-slate-500">{item.expenseId} · GST {formatCurrency(item.gstAmount)}</p></td><td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{formatDate(item.expenseDate)}</td><td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{item.vendor || item.project || item.category || 'Unassigned'}</td><td className="finance-value py-3 text-right font-semibold dark:text-white">{formatCurrency(item.amount)}</td></tr>)}</tbody></table></div>}</section>}
  </div>
}
