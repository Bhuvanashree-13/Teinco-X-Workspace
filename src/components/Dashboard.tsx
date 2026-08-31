import { useApi, formatCurrency } from '../hooks/useApi'
import { TrendingUp, TrendingDown, Wallet, CreditCard, Users, Server, Monitor, ArrowUpRight, Activity, Zap, HardDrive } from 'lucide-react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'

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
  categoryBreakdown: Array<{ category: string; color: string; amount: number }>
  upcomingExpenses: Array<any>
  monthlyTrend: Array<{ month: string; amount: number }>
  totalExpenses: number
}

export default function Dashboard() {
  const { data, loading } = useApi<DashboardData>('/dashboard/kpi')

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
    </div>
  )
  if (!data) return <div className="text-red-500 p-8">Failed to load dashboard data</div>

  const momChange = data.previousMonthSpend > 0 
    ? ((data.currentMonthSpend - data.previousMonthSpend) / data.previousMonthSpend * 100).toFixed(1)
    : '0'
  const isMomUp = Number(momChange) >= 0

  const kpiCards = [
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="brand-section-heading">Monthly Spend Trend</h3>
            <span className="brand-caption">Last 12 months</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data.monthlyTrend}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.18}/>
                  <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip 
                formatter={(v: number) => [formatCurrency(v), 'Amount']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Area type="monotone" dataKey="amount" stroke="#1E3A8A" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="brand-section-heading mb-4">Spend by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.categoryBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="amount"
                nameKey="category"
                stroke="none"
              >
                {data.categoryBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
            {data.categoryBreakdown.map((cat, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-gray-600 dark:text-gray-300 truncate">{cat.category}</span>
                </div>
                <span className="font-medium text-gray-900 dark:text-white shrink-0 ml-2">{formatCurrency(cat.amount)}</span>
              </div>
            ))}
          </div>
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

