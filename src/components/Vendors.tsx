import { useState } from 'react'
import { apiPost, useApi } from '../hooks/useApi'
import { Search, Plus, Store, TrendingUp, ArrowUpRight, Receipt, X } from 'lucide-react'
import { CardGridSkeleton } from './Skeleton'

const emptyVendorForm = {
  name: '',
  type: 'service',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  gstin: '',
  pan: '',
  country: 'India',
  currency: 'INR',
  city: '',
  state: '',
  notes: '',
}

export default function Vendors() {
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyVendorForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const { data, loading, refetch } = useApi(`/vendors?search=${encodeURIComponent(search)}`)

  const vendors = data || []

  const submitVendor = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await apiPost('/vendors', {
        name: form.name.trim(),
        type: form.type,
        contactName: form.contactName.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        gstin: form.gstin.trim() || null,
        pan: form.pan.trim() || null,
        country: form.country.trim() || 'India',
        currency: form.currency.trim() || 'INR',
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        notes: form.notes.trim() || null,
      })
      setForm(emptyVendorForm)
      setShowForm(false)
      setMessage('Vendor added successfully.')
      await refetch()
    } catch (error: any) {
      setMessage(error.message || 'Could not add vendor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="mobile-page-header">
        <div>
          <h2 className="brand-heading">Vendors</h2>
          <p className="brand-caption mt-1">Track vendor relationships and spending</p>
        </div>
        <div className="mobile-action-stack">
        <button type="button" onClick={() => setShowForm(true)} className="brand-primary-button">
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
        </div>
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search vendors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 dark:text-white"
        />
      </div>

      {loading ? (
        <CardGridSkeleton count={6} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((vendor: any) => (
            <div key={vendor.id} className="brand-card p-5 transition-all hover:shadow-md cursor-pointer group dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] dark:bg-gray-700 flex items-center justify-center">
                    <Store className="w-5 h-5 text-[#1E3A8A]" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-emerald-600 transition-colors">{vendor.name}</h3>
                    <p className="text-xs text-gray-500">{vendor.code} • {vendor.country}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  vendor.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {vendor.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Receipt className="w-3 h-3" /> Transactions
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white">{vendor._count?.expenses || 0}</p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <TrendingUp className="w-3 h-3" /> Subscriptions
                  </div>
                  <p className="font-semibold text-gray-900 dark:text-white">{vendor._count?.subscriptions || 0}</p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs text-gray-500">{vendor.type}</span>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600 transition-colors" />
              </div>
            </div>
          ))}
          {vendors.length === 0 && (
            <div className="brand-card p-8 text-center text-sm text-gray-500 md:col-span-2 lg:col-span-3">
              <Store className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              No vendors yet. Add your first vendor to use it in expenses and subscriptions.
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="mobile-dialog-overlay" onMouseDown={() => setShowForm(false)}>
          <div className="mobile-dialog-panel" onMouseDown={event => event.stopPropagation()}>
            <div className="mobile-dialog-header">
              <div>
                <h3 className="text-lg font-semibold text-[#1E3A8A] dark:text-white">Add vendor</h3>
                <p className="text-sm text-gray-500">Create a supplier record for expenses and subscriptions.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="mobile-dialog-close" aria-label="Close vendor form"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={submitVendor} className="mobile-dialog-form">
              <label className="text-sm dark:text-gray-200">Vendor name<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Type<select value={form.type} onChange={event => setForm({ ...form, type: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900"><option value="service">Service</option><option value="software">Software</option><option value="cloud">Cloud</option><option value="hardware">Hardware</option><option value="other">Other</option></select></label>
              <label className="text-sm dark:text-gray-200">Contact name<input value={form.contactName} onChange={event => setForm({ ...form, contactName: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Email<input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Phone<input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Website<input value={form.website} onChange={event => setForm({ ...form, website: event.target.value })} placeholder="https://example.com" className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">GSTIN<input value={form.gstin} onChange={event => setForm({ ...form, gstin: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">PAN<input value={form.pan} onChange={event => setForm({ ...form, pan: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Country<input value={form.country} onChange={event => setForm({ ...form, country: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">Currency<input value={form.currency} onChange={event => setForm({ ...form, currency: event.target.value.toUpperCase() })} maxLength={3} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">City<input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm dark:text-gray-200">State<input value={form.state} onChange={event => setForm({ ...form, state: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <label className="text-sm sm:col-span-2 dark:text-gray-200">Notes<textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className="mt-1 h-20 w-full rounded-lg border p-2.5 dark:border-gray-600 dark:bg-gray-900" /></label>
              <div className="mobile-form-actions dark:border-gray-700">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm dark:border-gray-600">Cancel</button>
                <button disabled={saving} className="brand-primary-button">{saving ? 'Saving…' : 'Save vendor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

