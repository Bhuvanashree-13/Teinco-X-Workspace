import { useState } from 'react'
import { apiPost, useApi, formatCurrency, formatDate } from '../hooks/useApi'
import { Search, Filter, Plus, Download, ChevronLeft, ChevronRight, FileText, X } from 'lucide-react'

const emptyForm = {
  expenseDate: new Date().toISOString().slice(0, 10), vendorId: '', description: '', categoryId: '',
  expenseType: 'one_time', baseAmount: '', gstAmount: '0', originalCurrency: 'INR', exchangeRate: '1',
  businessPurpose: '', invoiceNumber: '', taxDeductible: false, gstInputCredit: 'unknown'
}

export default function Expenses() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [expenseType, setExpenseType] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [limit] = useState(20)
  const { data, loading, refetch } = useApi(`/expenses?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&expenseType=${expenseType}`)
  const { data: vendors } = useApi<any[]>('/vendors?isActive=true')
  const { data: categories } = useApi<any[]>('/categories')

  const expenses = data?.expenses || []
  const total = data?.total || 0
  const totalPages = data?.totalPages || 1

  const baseAmount = Number(form.baseAmount) || 0
  const gstAmount = Number(form.gstAmount) || 0
  const totalAmount = baseAmount + gstAmount

  const submitExpense = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await apiPost('/expenses', {
        expenseDate: new Date(`${form.expenseDate}T12:00:00`).toISOString(),
        vendorId: form.vendorId ? Number(form.vendorId) : null,
        description: form.description.trim(), categoryId: Number(form.categoryId), expenseType: form.expenseType,
        baseAmount, gstAmount, totalAmount, originalCurrency: form.originalCurrency,
        originalAmount: totalAmount, exchangeRate: Number(form.exchangeRate) || 1,
        businessPurpose: form.businessPurpose || null, invoiceNumber: form.invoiceNumber || null,
        taxDeductible: form.taxDeductible, gstInputCredit: form.gstInputCredit,
      })
      setForm(emptyForm)
      setShowForm(false)
      setMessage('Expense recorded successfully.')
      setPage(1)
      await refetch()
    } catch (error: any) {
      setMessage(error.message || 'Could not save expense.')
    } finally { setSaving(false) }
  }

  const exportCsv = () => {
    const rows = [['Expense ID', 'Date', 'Vendor', 'Description', 'Category', 'Type', 'Amount'], ...expenses.map((e: any) => [
      e.expenseId, e.expenseDate, e.vendor?.name || '', e.description, e.category?.name || '', e.expenseType, e.baseCurrencyAmount
    ])]
    const csv = rows.map(row => row.map((value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`; link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="mobile-page-header">
        <div>
          <h2 className="brand-heading">Expenses</h2>
          <p className="brand-caption mt-1">Manage and track all company expenses</p>
        </div>
        <div className="mobile-action-stack">
          <button onClick={exportCsv} className="brand-secondary-button">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => setShowForm(true)} className="brand-primary-button">
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      <div className="brand-card overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="relative w-full flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ID, vendor, description..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 dark:text-white"
            />
          </div>
          <div className="relative w-full sm:w-auto">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select value={expenseType} onChange={e => { setExpenseType(e.target.value); setPage(1) }} className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white">
              <option value="">All expense types</option><option value="one_time">One time</option><option value="recurring">Recurring</option><option value="salary">Salary</option><option value="reimbursement">Reimbursement</option><option value="capex">Capital expense</option><option value="opex">Operating expense</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto" />
            <p className="text-gray-500 mt-3 text-sm">Loading expenses...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">ID</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Date</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Vendor</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Category</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Type</th>
                    <th className="px-4 py-3 font-medium text-right whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {expenses.map((exp: any) => (
                    <tr key={exp.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{exp.expenseId}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDate(exp.expenseDate)}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white whitespace-nowrap">{exp.vendor?.name || '-'}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white max-w-xs">
                        <div className="truncate" title={exp.description}>{exp.description}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: exp.category?.color + '18', color: exp.category?.color }}>
                          {exp.category?.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${
                          exp.expenseType === 'recurring' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                          exp.expenseType === 'capex' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          exp.expenseType === 'salary' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          exp.expenseType === 'one_time' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                          'bg-[#EFF6FF] text-[#1E3A8A] dark:bg-slate-800 dark:text-slate-200'
                        }`}>
                          {exp.expenseType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">{formatCurrency(exp.baseCurrencyAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {expenses.length === 0 && (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No expenses found</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
              </div>
            )}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">Showing {expenses.length} of {total} expenses</p>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                  className="p-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[3rem] text-center">{page} / {totalPages}</span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page >= totalPages}
                  className="p-1.5 border rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <div className="mobile-dialog-overlay" onMouseDown={() => setShowForm(false)}>
          <div className="mobile-dialog-panel" onMouseDown={e => e.stopPropagation()}>
            <div className="mobile-dialog-header"><div><h3 className="text-lg font-semibold dark:text-white">Record expense</h3><p className="text-sm text-gray-500">Amounts are stored in the company ledger.</p></div><button type="button" onClick={() => setShowForm(false)} className="mobile-dialog-close" aria-label="Close expense form"><X className="h-5 w-5" /></button></div>
            <form onSubmit={submitExpense} className="mobile-dialog-form">
              <label className="text-sm dark:text-gray-200">Date<input required type="date" value={form.expenseDate} onChange={e => setForm({...form, expenseDate:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Vendor<select value={form.vendorId} onChange={e => setForm({...form, vendorId:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900"><option value="">No vendor</option>{(vendors || []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
              <label className="text-sm sm:col-span-2 dark:text-gray-200">Description<input required value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder="What was purchased?" className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Category<select required value={form.categoryId} onChange={e => setForm({...form, categoryId:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900"><option value="">Select category</option>{(categories || []).filter(c => !c.parentId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="text-sm dark:text-gray-200">Expense type<select value={form.expenseType} onChange={e => setForm({...form, expenseType:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900"><option value="one_time">One time</option><option value="recurring">Recurring</option><option value="salary">Salary</option><option value="reimbursement">Reimbursement</option><option value="capex">Capital expense</option><option value="opex">Operating expense</option></select></label>
              <label className="text-sm dark:text-gray-200">Net amount (₹)<input required min="0.01" step="0.01" type="number" value={form.baseAmount} onChange={e => setForm({...form, baseAmount:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">GST amount (₹)<input min="0" step="0.01" type="number" value={form.gstAmount} onChange={e => setForm({...form, gstAmount:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Invoice number<input value={form.invoiceNumber} onChange={e => setForm({...form, invoiceNumber:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Business purpose<input value={form.businessPurpose} onChange={e => setForm({...form, businessPurpose:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="flex items-center gap-2 text-sm dark:text-gray-200"><input type="checkbox" checked={form.taxDeductible} onChange={e => setForm({...form, taxDeductible:e.target.checked})} /> Tax deductible</label>
              <div className="text-right"><p className="text-xs text-gray-500">Total payable</p><p className="text-xl font-bold dark:text-white">{formatCurrency(totalAmount)}</p></div>
              <div className="mobile-form-actions dark:border-gray-700"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600">Cancel</button><button disabled={saving} className="brand-primary-button">{saving ? 'Saving…' : 'Save expense'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

