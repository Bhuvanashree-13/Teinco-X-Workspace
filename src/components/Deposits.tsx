import { useState } from 'react'
import { ArrowDownToLine, BadgeIndianRupee, Building2, CheckCircle2, Landmark, Plus, X } from 'lucide-react'
import { apiPost, formatCurrency, formatDate, useApi } from '../hooks/useApi'

const defaults = {
  depositDate: new Date().toISOString().slice(0, 10),
  source: '', description: '', originalCurrency: 'INR', originalAmount: '', exchangeRate: '1',
  referenceNumber: '', paymentMethod: 'Bank transfer',
}

const currencySymbol: Record<string, string> = { INR: '₹', USD: '$', EUR: '€' }

export default function Deposits() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(defaults)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const { data, loading, refetch } = useApi<any>('/deposits')
  const amount = Number(form.originalAmount) || 0
  const rate = form.originalCurrency === 'INR' ? 1 : Number(form.exchangeRate) || 0
  const inrAmount = Math.round(amount * rate * 100) / 100

  const changeCurrency = (currency: string) => setForm({ ...form, originalCurrency: currency, exchangeRate: currency === 'INR' ? '1' : '' })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true); setMessage(''); setError('')
    try {
      await apiPost('/deposits', {
        ...form,
        depositDate: new Date(`${form.depositDate}T12:00:00`).toISOString(),
        originalAmount: amount,
        exchangeRate: rate,
      })
      setForm(defaults); setShowForm(false); setMessage('Deposit recorded successfully.'); await refetch()
    } catch (err: any) { setError(err.message || 'Could not record deposit.') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div className="mobile-page-header rounded-2xl bg-gradient-to-r from-[#1E3A8A] to-[#3157b7] p-5 text-white shadow-lg shadow-blue-950/10 sm:p-6">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Cash inflow</p><h2 className="mt-1 text-2xl font-semibold">Deposits</h2><p className="mt-1 text-sm text-blue-100">Record money received and track its INR value</p></div>
        <button onClick={() => setShowForm(true)} className="brand-primary-button"><Plus className="h-4 w-4" /> Add deposit</button>
      </div>
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="finance-stat-card"><div className="absolute right-0 top-0 h-24 w-24 -translate-y-8 translate-x-8 rounded-full bg-emerald-100/70 dark:bg-emerald-900/20" /><div className="relative flex items-start justify-between"><div><p className="brand-label">Total received</p><p className="finance-value mt-2 text-2xl font-semibold dark:text-white">{formatCurrency(data?.totalReceived || 0)}</p><p className="mt-1 text-xs text-gray-500">All deposits converted to INR</p></div><div className="rounded-xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-900/30"><BadgeIndianRupee className="h-5 w-5" /></div></div></div>
        <div className="finance-stat-card"><div className="relative flex items-start justify-between"><div><p className="brand-label">Deposits recorded</p><p className="mt-2 text-2xl font-semibold dark:text-white">{data?.deposits?.length || 0}</p><p className="mt-1 text-xs text-gray-500">Received transactions</p></div><div className="rounded-xl bg-blue-50 p-3 text-[#1E3A8A] dark:bg-blue-900/30 dark:text-blue-300"><ArrowDownToLine className="h-5 w-5" /></div></div></div>
      </div>
      <div className="brand-card overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-gray-700 sm:px-5"><div><h3 className="font-semibold text-slate-900 dark:text-white">Recent deposits</h3><p className="mt-0.5 text-xs text-slate-500">A complete record of received funds</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">INR ledger</span></div>
        {loading ? <p className="p-10 text-center text-sm text-gray-500">Loading deposits…</p> : (
          <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-gray-50 text-gray-500 dark:bg-gray-700/50"><tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3 text-right">Original</th><th className="px-4 py-3 text-right">INR amount</th></tr></thead>
          <tbody className="divide-y dark:divide-gray-700">{(data?.deposits || []).map((item: any) => <tr key={item.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-gray-700/30"><td className="px-4 py-4 font-mono text-xs text-gray-500">{item.depositId}</td><td className="px-4 py-4">{formatDate(item.depositDate)}</td><td className="px-4 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-[#1E3A8A] dark:bg-blue-900/30 dark:text-blue-300"><Building2 className="h-4 w-4" /></div><div><p className="font-medium dark:text-white">{item.source}</p><p className="text-xs text-gray-500">{item.description || item.paymentMethod}</p></div></div></td><td className="px-4 py-4 text-gray-500">{item.referenceNumber || '-'}</td><td className="px-4 py-4 text-right">{currencySymbol[item.originalCurrency]}{item.originalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} <span className="text-xs text-gray-400">{item.originalCurrency}</span></td><td className="px-4 py-4 text-right font-semibold text-emerald-700 dark:text-emerald-400">+ {formatCurrency(item.baseCurrencyAmount)}</td></tr>)}</tbody></table>
          {(data?.deposits || []).length === 0 && <div className="p-12 text-center"><Landmark className="mx-auto h-10 w-10 text-gray-300" /><p className="mt-3 text-sm text-gray-500">No deposits recorded yet</p></div>}</div>
        )}
      </div>
      {showForm && <div className="mobile-dialog-overlay" onMouseDown={() => setShowForm(false)}><div className="mobile-dialog-panel mobile-dialog-panel-lg" onMouseDown={e => e.stopPropagation()}><div className="mobile-dialog-header"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30"><ArrowDownToLine className="h-5 w-5" /></div><div><h3 className="text-lg font-semibold dark:text-white">Record deposit</h3><p className="text-sm text-gray-500">Foreign currency is automatically converted to INR.</p></div></div><button type="button" onClick={() => setShowForm(false)} className="mobile-dialog-close"><X className="h-5 w-5" /></button></div>
        <form onSubmit={submit} className="mobile-dialog-form">
          <label className="text-sm">Date<input required type="date" value={form.depositDate} onChange={e => setForm({...form, depositDate:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900" /></label>
          <label className="text-sm">Source<input required value={form.source} onChange={e => setForm({...form, source:e.target.value})} placeholder="Client or bank" className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900" /></label>
          <label className="text-sm">Currency<select value={form.originalCurrency} onChange={e => changeCurrency(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900"><option value="INR">INR — Indian Rupee</option><option value="USD">USD — US Dollar</option><option value="EUR">EUR — Euro</option></select></label>
          <label className="text-sm">Amount ({currencySymbol[form.originalCurrency]})<input required min="0.01" step="0.01" type="number" value={form.originalAmount} onChange={e => setForm({...form, originalAmount:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900" /></label>
          {form.originalCurrency !== 'INR' && <label className="text-sm sm:col-span-2">Exchange rate <span className="text-xs text-gray-500">(₹ for 1 {form.originalCurrency})</span><input required min="0.0001" step="0.0001" type="number" value={form.exchangeRate} onChange={e => setForm({...form, exchangeRate:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900" /></label>}
          <label className="text-sm">Reference number<input value={form.referenceNumber} onChange={e => setForm({...form, referenceNumber:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900" /></label>
          <label className="text-sm">Payment method<select value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900"><option>Bank transfer</option><option>UPI</option><option>Cash</option><option>Cheque</option><option>Other</option></select></label>
          <label className="text-sm sm:col-span-2">Description<input value={form.description} onChange={e => setForm({...form, description:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900" /></label>
          <div className="finance-summary sm:col-span-2"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3 text-left"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#1E3A8A] shadow-sm dark:bg-gray-700 dark:text-blue-300"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Final ledger amount</p><p className="text-xs text-slate-500">Saved in Indian Rupees</p></div></div><p className="text-2xl font-bold text-[#1E3A8A] dark:text-white">{formatCurrency(inrAmount)}</p></div></div>
          <div className="mobile-form-actions dark:border-gray-700"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving || inrAmount <= 0} className="brand-primary-button">{saving ? 'Saving…' : 'Save deposit'}</button></div>
        </form></div></div>}
    </div>
  )
}
