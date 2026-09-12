import { useState, type FormEvent } from 'react'
import { ArrowLeft, BarChart3, LockKeyhole, Moon, ShieldCheck, Sparkles, Sun, Workflow } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useRole } from '../context/RoleContext'
import { useTheme } from '../hooks/useTheme'
import GoogleSignIn from './GoogleSignIn'

export default function Login() {
  const { login } = useRole()
  const { resolvedTheme, toggle } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (loading) return
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#071127] p-4 sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(49,92,243,.5),transparent_34%),radial-gradient(circle_at_90%_80%,rgba(139,92,246,.32),transparent_30%)]" />
      <Link to="/" className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-white backdrop-blur"><ArrowLeft className="h-4 w-4"/>Company home</Link>
      <button
        type="button"
        onClick={toggle}
        className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
        aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
      <div className="relative w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/15 bg-white shadow-[0_30px_80px_rgba(0,0,0,.35)]">
        <div className="grid lg:grid-cols-[1.1fr_460px]">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#173baf] via-[#334fe0] to-[#6725b8] p-8 text-white md:p-12">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[48px] border-white/5"/><div className="absolute -bottom-24 left-1/3 h-60 w-60 rounded-full bg-cyan-300/15 blur-2xl"/>
            <div className="flex items-center gap-3">
              <img src="/teinco-logo.png" alt="Teinco-X" className="h-12 w-auto rounded-xl bg-white p-1"/>
              <div>
                <h1 className="font-heading text-xl font-semibold">Teinco-X Workspace</h1>
                <p className="text-sm text-white/70">Intelligence for everyday operations</p>
              </div>
            </div>
            <div className="relative mt-16"><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest"><Sparkles className="h-3.5 w-3.5"/>One connected workspace</div><h2 className="mt-5 max-w-lg font-heading text-4xl font-semibold leading-tight">See the work. Understand the signals. Act with confidence.</h2><p className="mt-5 max-w-xl leading-7 text-blue-100">Bring finance, people, projects, schedules, operational intelligence, and Vyom into a clear, secure business workspace.</p></div>
            <div className="relative mt-10 grid gap-3 sm:grid-cols-3"><Feature icon={BarChart3} title="Live insight"/><Feature icon={Workflow} title="Connected flow"/><Feature icon={ShieldCheck} title="Role-based"/></div>
          </div>
          <form onSubmit={submit} className="flex flex-col justify-center p-8 text-[#101828] md:p-12 dark:bg-gray-800 dark:text-white">
            <div className="mb-8">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-lg bg-[#EFF6FF] text-[#1E3A8A] dark:bg-blue-950/60 dark:text-blue-300">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-600">Welcome back</p><h2 className="brand-heading mt-2 text-[32px]">Sign in to your workspace</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Use the account provided by your Teinco-X administrator.</p>
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
            <GoogleSignIn disabled={loading} onBusy={setLoading} />
            <p className="mt-5 text-center text-xs text-slate-500 dark:text-slate-400">Secure access · Admin and employee roles · Verified workspace data</p>
          </form>
        </div>
      </div>
    </div>
  )
}

function Feature({icon:Icon,title}:{icon:typeof BarChart3;title:string}) { return <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><Icon className="h-5 w-5 text-cyan-200"/><p className="mt-3 text-sm font-semibold">{title}</p></div> }
