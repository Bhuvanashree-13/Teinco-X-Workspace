import { useState, type FormEvent } from 'react'
import { LockKeyhole, Moon, ShieldCheck, Sun, UserRound } from 'lucide-react'
import { useRole } from '../context/RoleContext'
import { useTheme } from '../hooks/useTheme'

export default function Login() {
  const { login } = useRole()
  const { resolvedTheme, toggle } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login({ email, password })
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#F3F4F6] p-6 dark:bg-gray-900">
      <button
        type="button"
        onClick={toggle}
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-amber-300 dark:hover:bg-gray-700"
        aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_18px_40px_rgba(17,24,39,0.12)] dark:border-gray-700 dark:bg-gray-800">
        <div className="grid md:grid-cols-[1fr_420px]">
          <div className="bg-[#1E3A8A] p-8 text-white md:p-10">
            <div className="flex items-center gap-3">
              <div className="relative grid h-10 w-10 place-items-center rounded-lg border border-white/20 bg-white/10">
                <span className="absolute h-[2px] w-5 rotate-45 rounded-full bg-white" />
                <span className="absolute h-[2px] w-5 -rotate-45 rounded-full bg-white" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#60A5FA]" />
                <span className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full bg-[#10B981]" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-semibold">Teinco-X Workspace</h1>
                <p className="text-sm text-white/70">Role-based operations login</p>
              </div>
            </div>
            <div className="mt-12 space-y-5">
              <div className="rounded-lg border border-white/10 bg-white/10 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Admin</div>
                <p className="mt-2 text-sm text-white/75">View attendance, manage People, Payroll, Ledger, Schedule, and Flow.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/10 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4" /> Employee</div>
                <p className="mt-2 text-sm text-white/75">Mark your own attendance manually and view your limited People workspace.</p>
              </div>
            </div>
          </div>
          <form onSubmit={submit} className="p-8 md:p-10">
            <div className="mb-8">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-lg bg-[#EFF6FF] text-[#1E3A8A] dark:bg-blue-950/60 dark:text-blue-300">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <h2 className="brand-heading text-[28px]">Sign in</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Use your Teinco-X Workspace account.</p>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:ring-[#1E3A8A] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Password
                <input
                  required
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm focus:ring-[#1E3A8A] dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </label>
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400">{error}</div>}
              <button disabled={loading} className="brand-primary-button w-full">
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
            <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">Access is provisioned privately by the workspace administrator.</p>
          </form>
        </div>
      </div>
    </div>
  )
}
