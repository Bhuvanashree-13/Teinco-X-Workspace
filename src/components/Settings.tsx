import { useState } from 'react'
import { apiPut, useApi } from '../hooks/useApi'
import { Building2, Wallet, Database, Bot } from 'lucide-react'
import { FormSkeleton } from './Skeleton'

export default function Settings() {
  const { data: settings, loading, error, refetch } = useApi('/settings')
  const [message, setMessage] = useState('')
  const [saveError, setSaveError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<any>({})

  if (loading) return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200/80 dark:bg-gray-700/60" />
        <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded-lg bg-slate-200/80 dark:bg-gray-700/60" />
      </div>
      <FormSkeleton />
    </div>
  )

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    setSaveError(false)
    try {
      await apiPut('/settings', formData)
      setFormData({})
      await refetch()
      setMessage('Settings saved.')
    } catch (e) {
      setSaveError(true)
      setMessage(e instanceof Error ? e.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  const current = { ...settings, ...formData }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <h2 className="brand-heading">Settings</h2>
        <p className="brand-caption mt-1">Configure your Teinco-X Workspace application</p>
      </div>

      {error && <p role="alert" className="text-red-700">Could not load settings. <button onClick={() => void refetch()} className="underline">Retry</button></p>}
      <fieldset disabled={saving || !!error} className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
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
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">Workspace Data Storage</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Your financial data is stored in the workspace server’s MySQL database. Use managed database backups and exports to protect your records.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="brand-card p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center gap-2"><Bot className="h-5 w-5" /><h3 className="text-lg font-semibold dark:text-white">Ask AI connection</h3></div>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Ask AI uses Ollama to select verified workspace facts. Configure the connection on the computer or server running this application.</p>
          <dl className="mt-4 space-y-4 text-sm">
            <div><dt className="font-medium">Server environment variables</dt><dd className="mt-2 break-all rounded-lg bg-slate-50 p-3 font-mono text-xs leading-6 dark:bg-gray-900">ASK_AI_OLLAMA_URL<br />ASK_AI_MODEL<br />ASK_AI_API_KEY (optional gateway credential)</dd></div>
            <div><dt className="font-medium">After configuration</dt><dd className="mt-1 text-slate-600 dark:text-slate-300">Restart the app server, then open Flow → Ask AI → Test connection. The test uses sample facts.</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">A hosted app needs an endpoint reachable from its server. Keep gateway credentials in server environment variables.</p>
        </div>
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 xl:col-span-2">
          <p role={saveError ? 'alert' : 'status'} className={`text-sm ${saveError ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-300'}`}>{message || 'Changes apply to your workspace.'}</p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="brand-primary-button px-6"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </fieldset>
    </div>
  )
}

