import { useState } from 'react'
import { useApi, formatCurrency } from '../hooks/useApi'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { BarChart3, PieChart as PieIcon, Building2 } from 'lucide-react'

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('category')
  const year = new Date().getFullYear()

  const categoryData = useApi(`/analytics/spend-by-category?year=${year}`)
  const vendorData = useApi(`/analytics/spend-by-vendor?year=${year}`)
  const projectData = useApi(`/analytics/project-allocation?year=${year}`)

  const tabs = [
    { id: 'category', label: 'By Category', icon: PieIcon },
    { id: 'vendor', label: 'By Vendor', icon: Building2 },
    { id: 'project', label: 'By Project', icon: BarChart3 },
  ]

  const renderContent = () => {
    if (activeTab === 'category') {
      if (categoryData.loading) return <LoadingState />
      if (!categoryData.data) return <ErrorState />
      const data = categoryData.data
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="brand-section-heading mb-4">Category Breakdown</h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={120}
                  paddingAngle={3}
                  dataKey="amount"
                  nameKey="category"
                  stroke="none"
                >
                  {data.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="brand-section-heading mb-4">Category Details</h3>
            <div className="space-y-3">
              {data.map((cat: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="font-medium text-gray-900 dark:text-white">{cat.category}</span>
                  </div>
                  <span className="finance-value font-semibold text-gray-900 dark:text-white">{formatCurrency(cat.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (activeTab === 'vendor') {
      if (vendorData.loading) return <LoadingState />
      if (!vendorData.data) return <ErrorState />
      const data = vendorData.data
      return (
        <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="brand-section-heading mb-4">Top Vendors by Spend</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis dataKey="vendor" type="category" width={140} tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="amount" fill="#1E3A8A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.slice(0, 6).map((v: any, i: number) => (
              <div key={i} className="p-3 border border-gray-100 dark:border-gray-700 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white text-sm">{v.vendor}</p>
                <p className="finance-value mt-1 text-lg font-semibold text-[#1E3A8A]">{formatCurrency(v.amount)}</p>
                <p className="text-xs text-gray-500">{v.transactions} transactions</p>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (activeTab === 'project') {
      if (projectData.loading) return <LoadingState />
      if (!projectData.data) return <ErrorState />
      const data = projectData.data
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="brand-section-heading mb-4">Project Allocation</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="amount"
                  nameKey="project"
                  stroke="none"
                >
                  {data.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="brand-section-heading mb-4">Project Breakdown</h3>
            <div className="space-y-3">
              {data.map((proj: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: proj.color }} />
                    <span className="font-medium text-gray-900 dark:text-white">{proj.project}</span>
                  </div>
                  <span className="finance-value font-semibold text-gray-900 dark:text-white">{formatCurrency(proj.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="brand-heading">Spend Intelligence</h2>
        <p className="brand-caption mt-1">Deep analytics on where your business money is going</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[#1E3A8A] text-[#1E3A8A]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {renderContent()}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="p-12 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto" />
      <p className="text-gray-500 mt-3 text-sm">Loading analytics...</p>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="p-12 text-center text-red-500">
      <p>Failed to load analytics data</p>
    </div>
  )
}

