import { useState } from 'react'
import { useApi, formatCurrency } from '../hooks/useApi'
import { TrendingUp, TrendingDown, Wallet, CreditCard, Users, Server, Monitor, ArrowUpRight, Activity, Zap, HardDrive, Landmark, ArrowDownToLine } from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'
import { StatCardsSkeleton, ChartSkeleton, Skeleton } from './Skeleton'

interface DashboardData {
  currentMonthSpend: number
  previousMonthSpend: number
  currentYearSpend: number
  previousYearSpend: number
  monthlyAverage: number
  recurringMonthlyCommitment: number
  recurringAnnualCommitment: number
  softwareSpend: number
  cloudSpend: number
  hardwareSpend: number
  peopleSpend: number
  categoryBreakdown: Array<{ categoryId: number | null; category: string; color: string; amount: number }>
  upcomingExpenses: Array<any>
  monthlyTrend: Array<{ month: string; amount: number }>
  totalExpenses: number
  totalDeposits: number
  depositCount: number
  availableBalance: number
}

export default function Dashboard() {
  const [trendMonths, setTrendMonths] = useState(6)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const { data, loading } = useApi<DashboardData>('/dashboard/kpi')

  if (loading) return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <StatCardsSkeleton count={8} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
          <ChartSkeleton />
        </div>
        <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
          <Skeleton className="mb-4 h-5 w-40" />
          <Skeleton className="h-56 w-full" />
        </div>
      </div>
    </div>
  )
  if (!data) return <div className="text-red-500 p-8">Failed to load dashboard data</div>

  const trend = data.monthlyTrend.slice(-trendMonths)
  const trendTotal = trend.reduce((total, month) => total + month.amount, 0)
  const categories = data.categoryBreakdown.filter(category => category.amount !== 0)
  const categoryTotal = categories.reduce((total, category) => total + category.amount, 0)
  const categoryScale = Math.max(...categories.map(category => Math.abs(category.amount)), 1)
  const visibleCategories = showAllCategories ? categories : categories.slice(0, 5)

  const momChange = data.previousMonthSpend > 0 
    ? ((data.currentMonthSpend - data.previousMonthSpend) / data.previousMonthSpend * 100).toFixed(1)
    : '0'
  const isMomUp = Number(momChange) >= 0

  const kpiCards = [
    {
      title: 'Available Balance',
      value: data.availableBalance,
      icon: Landmark,
      change: null,
      isUp: false,
      subtitle: 'Deposits less YTD spend'
    },
    {
      title: 'Total Deposits',
      value: data.totalDeposits,
      icon: ArrowDownToLine,
      change: null,
      isUp: false,
      subtitle: `${data.depositCount} received`
    },
    { 
      title: 'Current Month', 
      value: data.currentMonthSpend, 
      icon: Wallet, 
      change: momChange,
      isUp: isMomUp,
      subtitle: 'vs last month'
    },
    { 
      title: 'YTD Spend', 
      value: data.currentYearSpend, 
      icon: CreditCard,
      change: null,
      isUp: false,
      subtitle: `${data.totalExpenses} transactions`
    },
    { 
      title: 'Monthly Average', 
      value: data.monthlyAverage, 
      icon: Activity,
      change: null,
      isUp: false,
      subtitle: 'All time'
    },
    { 
      title: 'Recurring/Month', 
      value: data.recurringMonthlyCommitment, 
      icon: Zap,
      change: null,
      isUp: false,
      subtitle: `Annual: ${formatCurrency(data.recurringAnnualCommitment)}`
    },
    { 
      title: 'Software', 
      value: data.softwareSpend, 
      icon: Monitor,
      change: null,
      isUp: false,
      subtitle: 'YTD total'
    },
    { 
      title: 'Cloud/Infra', 
      value: data.cloudSpend, 
      icon: Server,
      change: null,
      isUp: false,
      subtitle: 'YTD total'
    },
    { 
      title: 'People', 
      value: data.peopleSpend, 
      icon: Users,
      change: null,
      isUp: false,
      subtitle: 'YTD total'
    },
    { 
      title: 'Hardware', 
      value: data.hardwareSpend, 
      icon: HardDrive,
      change: null,
      isUp: false,
      subtitle: 'CapEx YTD'
    },
  ]

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="brand-heading">Executive Dashboard</h2>
          <p className="brand-caption mt-1">Real-time financial intelligence for Teinco-X Workspace</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live Data
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card, i) => (
          <div key={i} className="brand-card p-5 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="brand-label">{card.title}</p>
                <p className="finance-value mt-1 text-xl font-semibold text-[#111827] dark:text-white">{formatCurrency(card.value)}</p>
                {card.change !== null && (
                  <p className={`text-xs mt-1 flex items-center gap-1 font-medium ${card.isUp ? 'text-red-500' : 'text-green-500'}`}>
                    {card.isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(Number(card.change))}% {card.subtitle}
                  </p>
                )}
                {card.change === null && (
                  <p className="text-xs text-gray-400 mt-1">{card.subtitle}</p>
                )}
              </div>
              <div className="p-2.5 bg-[#EFF6FF] dark:bg-gray-700/50 rounded-lg shrink-0 ml-3">
                <card.icon className="w-5 h-5 text-[#1E3A8A] dark:text-gray-300" strokeWidth={1.5} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="brand-card min-w-0 p-5 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="brand-section-heading">Monthly Spend</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Monthly totals · current month in progress</p>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1 dark:bg-gray-900" aria-label="Monthly spend period">
              {[6, 12].map(months => <button key={months} type="button" aria-pressed={trendMonths === months} onClick={() => setTrendMonths(months)} className={`rounded-md px-3 py-1 text-xs font-medium ${trendMonths === months ? 'bg-white text-blue-800 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{months} months</button>)}
            </div>
          </div>
          <div className="mt-5 mb-4">
            <p className="finance-value text-2xl font-semibold text-slate-900 dark:text-white">{formatCurrency(trendTotal)}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total over the last {trendMonths} months</p>
          </div>
          {trend.some(month => month.amount !== 0) ? <ResponsiveContainer width="100%" height={230}>
            <BarChart data={trend} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.4} />
              <XAxis dataKey="month" tickFormatter={month => month.slice(0, 3)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} stroke="#94a3b8" minTickGap={8} />
              <YAxis width={55} tickFormatter={value => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} stroke="#94a3b8" />
              <Tooltip cursor={{ fill: '#94a3b8', opacity: 0.1 }} formatter={(value: number) => [formatCurrency(value), 'Spend']} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', color: '#0f172a' }} />
              <Bar dataKey="amount" radius={[5, 5, 0, 0]} maxBarSize={42}>
                {trend.map((month, index) => <Cell key={month.month} fill={index === trend.length - 1 ? '#3b82f6' : '#93c5fd'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer> : <p className="flex h-[230px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">No spending recorded in this period.</p>}
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{trend[0]?.month} – {trend[trend.length - 1]?.month} · amounts in INR</p>
        </div>

        <div className="brand-card min-w-0 p-5 dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="brand-section-heading">Spend by Category</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current year · subcategories included</p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">{categories.length} categories</span>
          </div>
          <div className="mt-5 mb-5">
            <p className="finance-value text-2xl font-semibold text-slate-900 dark:text-white">{formatCurrency(categoryTotal)}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total categorized spend</p>
          </div>
          <div className="space-y-4">
            {visibleCategories.map(category => <div key={category.categoryId ?? 'uncategorized'}>
              <div className="mb-1.5 flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0 break-words font-medium text-slate-700 dark:text-slate-200">{category.category}</span>
                <span className="shrink-0 text-right"><span className="finance-value font-semibold text-slate-900 dark:text-white">{formatCurrency(category.amount)}</span><span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{categoryTotal > 0 ? `${(category.amount / categoryTotal * 100).toFixed(1)}%` : '—'}</span></span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-700"><div className="h-full rounded-full" style={{ width: `${Math.abs(category.amount) / categoryScale * 100}%`, backgroundColor: category.color }} /></div>
            </div>)}
            {!categories.length && <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">No category spending recorded this year.</p>}
          </div>
          {categories.length > 5 && <button type="button" onClick={() => setShowAllCategories(value => !value)} aria-expanded={showAllCategories} className="mt-5 text-sm font-medium text-blue-700 dark:text-blue-300">{showAllCategories ? 'Show fewer categories' : `View all ${categories.length} categories`}</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="brand-section-heading">Upcoming Recurring Expenses</h3>
            <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full font-medium">Next 30 days</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {data.upcomingExpenses.map((exp, i) => (
              <div key={i} className="py-3 flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-gray-700/30 px-2 -mx-2 rounded-lg transition-colors">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{exp.description}</p>
                  <p className="text-xs text-gray-500">{exp.vendor || 'Internal'} • {exp.category}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{formatCurrency(exp.amount)}</p>
                  <p className="text-xs text-gray-500">{exp.dueDate ? new Date(exp.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '-'}</p>
                </div>
              </div>
            ))}
            {data.upcomingExpenses.length === 0 && (
              <p className="py-8 text-gray-500 text-center text-sm">No upcoming expenses in the next 30 days</p>
            )}
          </div>
        </div>

        <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="brand-section-heading mb-4">Burn Rate Analysis</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Monthly Burn (Avg)</span>
                <span className="finance-value font-semibold text-gray-900 dark:text-white">{formatCurrency(data.monthlyAverage)}</span>
              </div>
              <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '65%' }} />
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Projected Annual</span>
                <span className="finance-value font-semibold text-gray-900 dark:text-white">{formatCurrency(data.monthlyAverage * 12)}</span>
              </div>
              <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '72%' }} />
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-300">Recurring Commitment</span>
                <span className="finance-value font-semibold text-gray-900 dark:text-white">{formatCurrency(data.recurringMonthlyCommitment)}</span>
              </div>
              <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div className="h-full bg-[#60A5FA] rounded-full" style={{ width: '45%' }} />
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/20 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-start gap-3">
                <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-200">Smart Insight</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Cloud infrastructure spending has increased 47% since January. Consider reviewing AWS reserved instances for potential savings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

