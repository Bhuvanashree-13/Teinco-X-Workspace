import { useEffect, useRef, useState } from 'react'
import { useRole } from '../context/RoleContext'

type GoogleIdentity = {
  initialize: (options: { client_id: string; nonce: string; auto_select: boolean; callback: (response: { credential: string }) => void }) => void
  renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string; width: number }) => void
}

const identityApi = () => (window as Window & { google?: { accounts?: { id?: GoogleIdentity } } }).google?.accounts?.id
let sdkPromise: Promise<GoogleIdentity> | undefined

function loadGoogle() {
  const existing = identityApi()
  if (existing) return Promise.resolve(existing)
  if (!sdkPromise) {
    sdkPromise = new Promise<GoogleIdentity>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      const fail = () => {
        window.clearTimeout(timeout)
        script.remove()
        sdkPromise = undefined
        reject(new Error('Google sign-in could not load. Check your connection and try again.'))
      }
      const timeout = window.setTimeout(fail, 15000)
      script.onerror = fail
      script.onload = () => {
        window.clearTimeout(timeout)
        const api = identityApi()
        if (api) resolve(api)
        else fail()
      }
      document.head.appendChild(script)
    })
  }
  return sdkPromise
}

export default function GoogleSignIn({ disabled, onBusy }: { disabled: boolean; onBusy: (busy: boolean) => void }) {
  const { loginWithGoogle } = useRole()
  const button = useRef<HTMLDivElement>(null)
  const login = useRef(loginWithGoogle)
  const busy = useRef(disabled)
  login.current = loginWithGoogle
  busy.current = disabled
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    button.current?.toggleAttribute('inert', disabled || !ready)
  }, [disabled, ready])

  useEffect(() => {
    let cancelled = false
    let refresh: number | undefined
    setReady(false)
    const prepare = async () => {
      try {
        const res = await fetch('/api/auth/google/config', { cache: 'no-store', credentials: 'same-origin' })
        if (!res.ok) throw new Error('Google sign-in is temporarily unavailable.')
        const config = await res.json()
        if (cancelled) return
        setEnabled(config.enabled)
        if (!config.enabled) return
        const google = await loadGoogle()
        if (cancelled || !button.current) return
        google.initialize({
          client_id: config.clientId,
          nonce: config.nonce,
          auto_select: false,
          callback: async ({ credential }) => {
            if (cancelled || busy.current) return
            window.clearTimeout(refresh)
            busy.current = true
            onBusy(true)
            setError('')
            try {
              await login.current(credential)
            } catch (err) {
              if (!cancelled) {
                setError(err instanceof Error ? err.message : 'Google sign-in failed.')
                setAttempt(value => value + 1)
              }
            } finally {
              if (!cancelled) onBusy(false)
            }
          },
        })
        button.current.replaceChildren()
        google.renderButton(button.current, { theme: 'outline', size: 'large', text: 'signin_with', width: Math.min(320, button.current.clientWidth || 240) })
        setReady(true)
        refresh = window.setTimeout(() => setAttempt(value => value + 1), 9 * 60 * 1000)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Google sign-in is unavailable.')
      }
    }
    void prepare()
    return () => { cancelled = true; window.clearTimeout(refresh) }
  }, [attempt, onBusy])

  return <div className="mt-5 space-y-3">
    <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-gray-700" />or<span className="h-px flex-1 bg-slate-200 dark:bg-gray-700" /></div>
    {!ready && <button type="button" disabled aria-describedby="google-signin-status" className="flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-900 dark:text-slate-300">Sign in with Google</button>}
    <div ref={button} className={!ready ? 'hidden' : disabled ? 'pointer-events-none flex justify-center opacity-50' : 'flex justify-center'} />
    {enabled === false && <p id="google-signin-status" className="text-center text-xs text-slate-500 dark:text-slate-400" role="status">Google sign-in is awaiting workspace setup. Please use your email and password for now.</p>}
    {enabled !== false && !ready && !error && <p id="google-signin-status" className="text-center text-xs text-slate-500" role="status">Loading Google sign-in…</p>}
    {error && <div className="text-sm text-red-700 dark:text-red-400" role="alert">{error}<button type="button" disabled={disabled} onClick={() => { setError(''); setAttempt(value => value + 1) }} className="ml-2 underline">Retry</button></div>}
    {ready && <p className="text-center text-xs text-slate-500 dark:text-slate-400">Admins and employees: use the Google account matching your workspace email.</p>}
  </div>
}
