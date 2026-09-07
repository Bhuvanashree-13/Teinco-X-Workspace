import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Send, FileText } from 'lucide-react'
import { apiPost, useApi } from '../hooks/useApi'
type Fact = { id: string; text: string; source: { label: string; href: string } }
type Evidence = { facts: Fact[]; start: string; end: string; retrievedAt: string; coverage: string[]; message?: string; status?: string }
const examples = ['How much have we spent?', 'Which vendors account for the most spending?', 'What are the largest expenses?', 'How much was received in deposits?']
export default function AskAI() {
  const { data: config, loading: configLoading, error: configError, refetch } = useApi<{ enabled: boolean }>('/flow/ask/config')
  const [question, setQuestion] = useState('')
  const [period, setPeriod] = useState('month')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [answer, setAnswer] = useState<Evidence | null>(null)
  const [asked, setAsked] = useState('')
  const [preview, setPreview] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !question.trim() || !config?.enabled) return
    setBusy(true); setError(''); setAnswer(null); setPreview(false); setAsked(question.trim())
    try { setAnswer(await apiPost('/flow/ask', { question: question.trim(), period })) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not answer this question.') }
    finally { setBusy(false) }
  }
  async function viewFacts() {
    if (busy) return
    setBusy(true); setError(''); setAnswer(null); setAsked(''); setPreview(true)
    try {
      const token = localStorage.getItem('teinco-x-token')
      const response = await fetch(`/api/flow/ask/context?period=${period}`, { headers: { Authorization: `Bearer ${token || ''}` } })
      if (!response.ok) throw new Error('Could not retrieve workspace evidence.')
      setAnswer(await response.json())
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load facts.') }
    finally { setBusy(false) }
  }
  return <section className="mx-auto max-w-4xl space-y-5">
    <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><Bot className="h-6 w-6" /></span><div><h3 className="text-xl font-semibold text-slate-900 dark:text-white">Ask your workspace</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Verified financial facts, with sources. Read-only, admin access.</p></div></div>
    {configLoading ? <p role="status">Checking model availability…</p> : configError ? <p role="alert" className="text-red-700 dark:text-red-300">Could not check Ask AI configuration. <button onClick={() => void refetch()} className="underline">Retry</button></p> : !config?.enabled && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Ask AI is awaiting model setup. You can view verified workspace facts below while it is being configured.</p>}
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <label className="block text-sm font-medium">Reporting period<select disabled={busy} value={period} onChange={event => { setPeriod(event.target.value); setAnswer(null); setError('') }} className="ml-3 rounded-lg border bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"><option value="month">Month to date</option><option value="last_month">Last completed month</option><option value="year">Year to date</option></select></label>
      <label className="mt-4 block text-sm font-medium">Your question<textarea required minLength={3} maxLength={1000} disabled={busy} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Which category accounts for the most spending?" className="mt-2 min-h-24 w-full rounded-lg border p-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" /></label>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Each question is independent and uses the period above. Supported: spending totals, deposits, category and vendor rankings, largest expenses. No predictions or record changes.</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={busy || configLoading || !!configError} onClick={() => void viewFacts()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-600"><FileText className="h-4 w-4" />View available facts</button><button disabled={busy || !config?.enabled || question.trim().length < 3} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Send className="h-4 w-4" />{busy ? 'Working…' : 'Ask AI'}</button></div>
    </form>
    <div className="flex flex-wrap gap-2">{examples.map(example => <button type="button" disabled={busy} key={example} onClick={() => setQuestion(example)} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-blue-400 dark:border-gray-600 dark:text-slate-300">{example}</button>)}</div>
    {error && <p role="alert" className="rounded-lg border border-red-200 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-300">{error}</p>}
    {answer && <article aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><h4 className="font-semibold">{preview ? 'Available workspace facts (not an AI answer)' : asked}</h4>{answer.message && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{answer.message}</p>}<p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{new Date(answer.start).toLocaleString()} – {new Date(answer.end).toLocaleString()} · Retrieved {new Date(answer.retrievedAt).toLocaleTimeString()}</p><ol className="mt-4 space-y-4">{answer.facts.map((fact, index) => <li key={fact.id} className="rounded-lg bg-slate-50 p-4 dark:bg-gray-900/50"><p className="text-sm leading-6">{fact.text}</p><Link to={fact.source.href} className="mt-2 inline-block text-xs text-blue-700 underline dark:text-blue-300">[{index + 1}] {fact.source.label}</Link></li>)}</ol><details className="mt-5 text-xs text-slate-500 dark:text-slate-400"><summary className="cursor-pointer">Coverage and limits</summary><ul className="mt-2 list-disc space-y-2 pl-4">{answer.coverage.map(line => <li key={line}>{line}</li>)}</ul></details></article>}
  </section>
}
