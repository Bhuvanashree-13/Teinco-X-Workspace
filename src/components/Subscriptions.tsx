import { useState } from 'react'
import { apiPost, useApi, formatCurrency, formatDate } from '../hooks/useApi'
import { Calendar, Plus, AlertCircle, CheckCircle2, Clock, RefreshCw, X } from 'lucide-react'
import { useRole } from '../context/RoleContext'

const emptySubscriptionForm = {
  productName: '',
  vendorId: '',
  categoryId: '',
  cost: '',
  currency: 'INR',
  billingCycle: 'monthly',
  startDate: new Date().toISOString().slice(0, 10),
  nextBillingDate: '',
  owner: '',
  businessPurpose: '',
  status: 'active',
  autoRenewal: true,
  notes: '',
}

export default function Subscriptions() {
  const { isAdmin } = useRole()
  const [filter, setFilter] = useState('active')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptySubscriptionForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const { data, loading, refetch } = useApi(`/subscriptions?status=${filter}`)
  const { data: vendors } = useApi<any[]>('/vendors?isActive=true')
  const { data: categories } = useApi<any[]>('/categories')

  const subs = data || []

  const submitSubscription = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await apiPost('/subscriptions', {
        productName: form.productName.trim(),
        vendorId: form.vendorId ? Number(form.vendorId) : null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        cost: Number(form.cost) || 0,
        currency: form.currency.trim() || 'INR',
        billingCycle: form.billingCycle,
        startDate: new Date(`${form.startDate}T12:00:00`).toISOString(),
        nextBillingDate: form.nextBillingDate ? new Date(`${form.nextBillingDate}T12:00:00`).toISOString() : null,
        owner: form.owner.trim() || null,
        businessPurpose: form.businessPurpose.trim() || null,
        status: form.status,
        autoRenewal: form.autoRenewal,
        notes: form.notes.trim() || null,
      })
      setForm(emptySubscriptionForm)
      setShowForm(false)
      setFilter('active')
      setMessage('Subscription added successfully.')
      await refetch()
    } catch (error: any) {
      setMessage(error.message || 'Could not add subscription.')
    } finally {
      setSaving(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'trial': return <Clock className="w-4 h-4 text-amber-500" />
      case 'cancelled': return <AlertCircle className="w-4 h-4 text-red-500" />
      default: return <RefreshCw className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'trial': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  return (
    <div className="space-y-6">
      <div className="mobile-page-header">
        <div>
          <h2 className="brand-heading">Subscriptions</h2>
          <p className="brand-caption mt-1">Track recurring software and service commitments</p>
        </div>
        {isAdmin && (
          <div className="mobile-action-stack">
          <button type="button" onClick={() => setShowForm(true)} className="brand-primary-button">
            <Plus className="w-4 h-4" /> Add Subscription
          </button>
          </div>
        )}
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
      {!isAdmin && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-slate-300">
          Employee view: subscription records are visible for awareness. Only admins can add or edit company subscriptions.
        </div>
      )}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {['active', 'all', 'trial', 'cancelled'].map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === f 
                ? 'bg-[#1E3A8A] text-white' 
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto" />
        </div>
      ) : (
        <div className="brand-card overflow-hidden dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Subscription</th>
                  <th className="px-4 py-3 font-medium">Vendor</th>
                  <th className="px-4 py-3 font-medium">Cycle</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                  <th className="px-4 py-3 font-medium">Next Billing</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {subs.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{sub.productName}</div>
                      <div className="text-xs text-gray-500">{sub.subscriptionId}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{sub.vendor?.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <RefreshCw className="w-3 h-3" />
                        {sub.billingCycle}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{formatCurrency(Number(sub.cost))}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {sub.nextBillingDate ? (
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          {formatDate(sub.nextBillingDate)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium capitalize ${getStatusClass(sub.status)}`}>
                        {getStatusIcon(sub.status)}
                        {sub.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {subs.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p>No subscriptions found</p>
            </div>
          )}
        </div>
      )}

      {isAdmin && showForm && (
        <div className="mobile-dialog-overlay" onMouseDown={() => setShowForm(false)}>
          <div className="mobile-dialog-panel" onMouseDown={event => event.stopPropagation()}>
            <div className="mobile-dialog-header">
              <div>
                <h3 className="text-lg font-semibold text-[#1E3A8A] dark:text-white">Add subscription</h3>
                <p className="text-sm text-gray-500">Track recurring tools, services, and renewal commitments.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="mobile-dialog-close" aria-label="Close subscription form"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={submitSubscription} className="mobile-dialog-form">
              <label className="text-sm dark:text-gray-200">Subscription name<input required value={form.productName} onChange={event => setForm({ ...form, productName: event.target.value })} placeholder="e.g. Accounting software" className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Vendor<select value={form.vendorId} onChange={event => setForm({ ...form, vendorId: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900"><option value="">No vendor</option>{(vendors || []).map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
              <label className="text-sm dark:text-gray-200">Category<select value={form.categoryId} onChange={event => setForm({ ...form, categoryId: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900"><option value="">No category</option>{(categories || []).filter(category => !category.parentId).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="text-sm dark:text-gray-200">Billing cycle<select value={form.billingCycle} onChange={event => setForm({ ...form, billingCycle: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900"><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="quarterly">Quarterly</option><option value="half_yearly">Half yearly</option><option value="weekly">Weekly</option><option value="daily">Daily</option></select></label>
              <label className="text-sm dark:text-gray-200">Cost<input required min="0.01" step="0.01" type="number" value={form.cost} onChange={event => setForm({ ...form, cost: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Currency<input value={form.currency} onChange={event => setForm({ ...form, currency: event.target.value.toUpperCase() })} maxLength={3} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Start date<input required type="date" value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Next billing date<input type="date" value={form.nextBillingDate} onChange={event => setForm({ ...form, nextBillingDate: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Owner<input value={form.owner} onChange={event => setForm({ ...form, owner: event.target.value })} placeholder="Team or person responsible" className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900"><option value="active">Active</option><option value="trial">Trial</option><option value="cancelled">Cancelled</option></select></label>
              <label className="text-sm sm:col-span-2 dark:text-gray-200">Business purpose<input value={form.businessPurpose} onChange={event => setForm({ ...form, businessPurpose: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm sm:col-span-2 dark:text-gray-200">Notes<textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className="mt-1 h-20 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="flex items-center gap-2 text-sm dark:text-gray-200"><input type="checkbox" checked={form.autoRenewal} onChange={event => setForm({ ...form, autoRenewal: event.target.checked })} /> Auto-renewal enabled</label>
              <div className="mobile-form-actions dark:border-gray-700">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600">Cancel</button>
                <button disabled={saving} className="brand-primary-button">{saving ? 'Saving…' : 'Save subscription'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

