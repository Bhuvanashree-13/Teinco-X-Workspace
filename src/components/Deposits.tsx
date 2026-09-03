import { useState } from 'react'
import { Landmark, Plus, X } from 'lucide-react'
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
      <div className="mobile-page-header">
        <div><h2 className="brand-heading">Deposits</h2><p className="brand-caption mt-1">Record money received and track its INR value</p></div>
        <button onClick={() => setShowForm(true)} className="brand-primary-button"><Plus className="h-4 w-4" /> Add deposit</button>
      </div>
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="brand-card p-5 dark:border-gray-700 dark:bg-gray-800"><p className="brand-label">Total received</p><p className="finance-value mt-2 text-2xl font-semibold dark:text-white">{formatCurrency(data?.totalReceived || 0)}</p><p className="mt-1 text-xs text-gray-500">All deposits converted to INR</p></div>
        <div className="brand-card p-5 dark:border-gray-700 dark:bg-gray-800"><p className="brand-label">Deposits recorded</p><p className="mt-2 text-2xl font-semibold dark:text-white">{data?.deposits?.length || 0}</p><p className="mt-1 text-xs text-gray-500">Received transactions</p></div>
      </div>
      <div className="brand-card overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        {loading ? <p className="p-10 text-center text-sm text-gray-500">Loading deposits…</p> : (
          <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-gray-50 text-gray-500 dark:bg-gray-700/50"><tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3 text-right">Original</th><th className="px-4 py-3 text-right">INR amount</th></tr></thead>
          <tbody className="divide-y dark:divide-gray-700">{(data?.deposits || []).map((item: any) => <tr key={item.id}><td className="px-4 py-3 font-mono text-xs text-gray-500">{item.depositId}</td><td className="px-4 py-3">{formatDate(item.depositDate)}</td><td className="px-4 py-3"><p className="font-medium dark:text-white">{item.source}</p><p className="text-xs text-gray-500">{item.description}</p></td><td className="px-4 py-3 text-gray-500">{item.referenceNumber || '-'}</td><td className="px-4 py-3 text-right">{currencySymbol[item.originalCurrency]}{item.originalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {item.originalCurrency}</td><td className="px-4 py-3 text-right font-semibold dark:text-white">{formatCurrency(item.baseCurrencyAmount)}</td></tr>)}</tbody></table>
          {(data?.deposits || []).length === 0 && <div className="p-12 text-center"><Landmark className="mx-auto h-10 w-10 text-gray-300" /><p className="mt-3 text-sm text-gray-500">No deposits recorded yet</p></div>}</div>
        )}
      </div>
      {showForm && <div className="mobile-dialog-overlay" onMouseDown={() => setShowForm(false)}><div className="mobile-dialog-panel" onMouseDown={e => e.stopPropagation()}><div className="mobile-dialog-header"><div><h3 className="text-lg font-semibold dark:text-white">Record deposit</h3><p className="text-sm text-gray-500">Foreign currency is automatically converted to INR.</p></div><button type="button" onClick={() => setShowForm(false)} className="mobile-dialog-close"><X className="h-5 w-5" /></button></div>
        <form onSubmit={submit} className="mobile-dialog-form">
          <label className="text-sm">Date<input required type="date" value={form.depositDate} onChange={e => setForm({...form, depositDate:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900" /></label>
          <label className="text-sm">Source<input required value={form.source} onChange={e => setForm({...form, source:e.target.value})} placeholder="Client or bank" className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900" /></label>
          <label className="text-sm">Currency<select value={form.originalCurrency} onChange={e => changeCurrency(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900"><option value="INR">INR — Indian Rupee</option><option value="USD">USD — US Dollar</option><option value="EUR">EUR — Euro</option></select></label>
          <label className="text-sm">Amount ({currencySymbol[form.originalCurrency]})<input required min="0.01" step="0.01" type="number" value={form.originalAmount} onChange={e => setForm({...form, originalAmount:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900" /></label>
          {form.originalCurrency !== 'INR' && <label className="text-sm sm:col-span-2">Exchange rate <span className="text-xs text-gray-500">(₹ for 1 {form.originalCurrency})</span><input required min="0.0001" step="0.0001" type="number" value={form.exchangeRate} onChange={e => setForm({...form, exchangeRate:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900" /></label>}
          <label className="text-sm">Reference number<input value={form.referenceNumber} onChange={e => setForm({...form, referenceNumber:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900" /></label>
          <label className="text-sm">Payment method<select value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900"><option>Bank transfer</option><option>UPI</option><option>Cash</option><option>Cheque</option><option>Other</option></select></label>
          <label className="text-sm sm:col-span-2">Description<input value={form.description} onChange={e => setForm({...form, description:e.target.value})} className="mt-1 w-full rounded-lg border p-2.5 dark:bg-gray-900" /></label>
          <div className="sm:col-span-2 rounded-lg bg-slate-50 p-4 text-right dark:bg-gray-700"><p className="text-xs text-gray-500">Final amount in INR</p><p className="text-xl font-bold dark:text-white">{formatCurrency(inrAmount)}</p></div>
          <div className="mobile-form-actions dark:border-gray-700"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving || inrAmount <= 0} className="brand-primary-button">{saving ? 'Saving…' : 'Save deposit'}</button></div>
        </form></div></div>}
    </div>
  )
}
