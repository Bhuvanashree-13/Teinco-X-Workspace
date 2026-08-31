import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { Building2, Wallet, Database } from 'lucide-react'

export default function Settings() {
  const { data: settings, loading } = useApi('/settings')
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<any>({})

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
    </div>
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, ...formData })
      })
      window.location.reload()
    } catch (e) {
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  const current = { ...settings, ...formData }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="brand-heading">Settings</h2>
        <p className="brand-caption mt-1">Configure your Teinco-X Workspace application</p>
      </div>

      <div className="space-y-6">
        {/* Company */}
        <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-slate-700" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Company Information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
              <input
                type="text"
                value={current.companyName || ''}
                onChange={(e) => updateField('companyName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Country</label>
              <input
                type="text"
                value={current.country || ''}
                onChange={(e) => updateField('country', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GSTIN</label>
              <input
                type="text"
                value={current.gstin || ''}
                onChange={(e) => updateField('gstin', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PAN</label>
              <input
                type="text"
                value={current.pan || ''}
                onChange={(e) => updateField('pan', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Currency & Reporting */}
        <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-slate-700" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Currency & Reporting</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Base Currency</label>
              <select
                value={current.baseCurrency || 'INR'}
                onChange={(e) => updateField('baseCurrency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 dark:bg-gray-700 dark:text-white"
              >
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reporting Year</label>
              <select
                value={current.reportingYear || 'calendar'}
                onChange={(e) => updateField('reportingYear', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 dark:bg-gray-700 dark:text-white"
              >
                <option value="calendar">Calendar Year (Jan-Dec)</option>
                <option value="financial">Financial Year (Apr-Mar)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Backup */}
        <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-slate-700" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Backup & Data</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backup Directory</label>
              <input
                type="text"
                value={current.backupPath || './backups'}
                onChange={(e) => updateField('backupPath', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auto Backup Interval (hours)</label>
              <input
                type="number"
                value={current.autoBackupInterval || 24}
                onChange={(e) => updateField('autoBackupInterval', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={current.autoBackup || false}
                onChange={(e) => updateField('autoBackup', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label className="text-sm text-gray-700 dark:text-gray-300">Enable automatic backups</label>
            </div>
          </div>
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/20 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">Local Data Storage</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Your financial data is stored locally in an SQLite database at <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">prisma/teinco_finance.db</code>. 
                  No data leaves your computer unless you explicitly export it.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="brand-primary-button px-6"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

