import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Send, FileText, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { apiPost, useApi } from '../hooks/useApi'
type Fact = { id: string; text: string; source: { label: string; href: string } }
type Evidence = { facts: Fact[]; start: string; end: string; retrievedAt: string; coverage: string[]; message?: string; status?: string }
type ChatMessage = { role: 'user' | 'assistant'; content: string; evidence?: Evidence }
type SpeechResultEvent = { results: { 0: { 0: { transcript: string } } } }
type SpeechRecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((event: SpeechResultEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null }
const examples = ["What's happening in the workspace?", 'What needs my attention today?', 'Are any tasks blocked?', 'What meetings are coming up?', 'How much have we spent?']
export default function AskAI() {
  const { data: config, loading: configLoading, error: configError, refetch } = useApi<{ enabled: boolean; model: string | null }>('/flow/ask/config')
  const [question, setQuestion] = useState('')
  const [period, setPeriod] = useState('month')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [answer, setAnswer] = useState<Evidence | null>(null)
  const [preview, setPreview] = useState(false)
  const [connection, setConnection] = useState('')
  const [testing, setTesting] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [listening, setListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceError, setVoiceError] = useState('')
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  useEffect(() => () => { recognition.current?.abort(); window.speechSynthesis?.cancel() }, [])
  function speak(result: Evidence) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return
    const text = result.facts?.length ? result.facts.map(fact => fact.text).join(' ') : result.message || ''
    if (!text) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-IN'; utterance.rate = 0.95
    window.speechSynthesis.speak(utterance)
  }
  async function testConnection() {
    setTesting(true); setConnection('')
    try { const result = await apiPost('/flow/ask/test', {}); setConnection(result.message) }
    catch (err) { setConnection(err instanceof Error ? err.message : 'Connection failed.') }
    finally { setTesting(false) }
  }
  async function ask(promptValue: string) {
    if (busy || !promptValue.trim() || !config?.enabled) return
    const prompt = promptValue.trim(), history = messages.slice(-12).map(({ role, content }) => ({ role, content }))
    setBusy(true); setError(''); setAnswer(null); setPreview(false); setMessages(current => [...current, { role: 'user', content: prompt }]); setQuestion('')
    try { const result: Evidence = await apiPost('/flow/ask', { question: prompt, period, history }); setAnswer(result); setMessages(current => [...current, { role: 'assistant', content: result.message || 'Here is what I found.', evidence: result }]); speak(result) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not answer this question.') }
    finally { setBusy(false) }
  }
  async function submit(event: FormEvent) { event.preventDefault(); await ask(question) }
  function listen() {
    if (listening) { recognition.current?.stop(); return }
    const SpeechRecognitionConstructor = (window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition
    if (!SpeechRecognitionConstructor) { setVoiceError('Voice recognition is not supported by this browser. Use Chrome or Edge.'); return }
    setVoiceError('')
    const instance = new SpeechRecognitionConstructor()
    recognition.current = instance; instance.lang = 'en-IN'; instance.continuous = false; instance.interimResults = false
    instance.onresult = event => { const transcript = event.results[0][0].transcript.trim(); setQuestion(transcript); if (transcript) void ask(transcript) }
    instance.onerror = () => setVoiceError('Vyom could not hear that. Check microphone permission and try again.')
    instance.onend = () => setListening(false)
    setListening(true); instance.start()
  }
  async function viewFacts() {
    if (busy) return
    setBusy(true); setError(''); setAnswer(null); setPreview(true)
    try {
      const token = localStorage.getItem('teinco-x-token')
      const response = await fetch(`/api/flow/ask/context?period=${period}`, { headers: { Authorization: `Bearer ${token || ''}` } })
      if (!response.ok) throw new Error('Could not retrieve workspace evidence.')
      setAnswer(await response.json())
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load facts.') }
    finally { setBusy(false) }
  }
  return <section className="w-full min-w-0 space-y-5">
    <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><Bot className="h-6 w-6" /></span><div><h3 className="text-xl font-semibold text-slate-900 dark:text-white">Vyom</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your conversational workspace assistant, with verified sources.</p></div></div>
    {configLoading ? <p role="status">Checking model availability…</p> : configError ? <p role="alert" className="text-red-700 dark:text-red-300">Could not check Vyom configuration. <button onClick={() => void refetch()} className="underline">Retry</button></p> : !config?.enabled && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Vyom needs a model connection. Open Settings for setup details. You can still view verified workspace facts below.</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"><div><p className="text-sm font-medium">{config?.enabled ? `Ollama · ${config.model}` : 'Model not configured'}</p><p role="status" className="mt-1 text-xs text-slate-500 dark:text-slate-400">{connection || 'Test the connection before asking a question.'}</p></div><button type="button" disabled={testing || !config?.enabled} onClick={() => void testConnection()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-600">{testing ? 'Testing…' : 'Test connection'}</button></div>
    {!!messages.length && <div aria-live="polite" className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">{messages.map((message, index) => <div key={index} className={`max-w-3xl rounded-xl p-4 ${message.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'bg-white dark:bg-gray-800'}`}><p className="text-sm leading-6">{message.content}</p>{message.evidence?.facts.map((fact, factIndex) => <div key={fact.id} className="mt-3 border-t border-slate-200 pt-3 dark:border-gray-700"><p className="text-sm">{fact.text}</p><Link to={fact.source.href} className="mt-1 inline-block text-xs text-blue-700 underline dark:text-blue-300">[{factIndex + 1}] {fact.source.label}</Link></div>)}</div>)}</div>}
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <label className="flex flex-col gap-2 text-sm font-medium sm:flex-row sm:items-center sm:gap-4">Reporting period<select disabled={busy} value={period} onChange={event => { setPeriod(event.target.value); setAnswer(null); setError('') }} className="w-full rounded-lg border bg-white sm:w-auto px-3 py-2 dark:border-gray-600 dark:bg-gray-900"><option value="month">Month to date</option><option value="last_month">Last completed month</option><option value="year">Year to date</option></select></label>
      <label className="mt-4 block text-sm font-medium">Message Vyom<textarea required minLength={3} maxLength={1000} disabled={busy} value={question} onChange={event => setQuestion(event.target.value)} placeholder="What's happening in the workspace?" className="mt-2 min-h-28 w-full rounded-lg border p-3 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white" /></label>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Vyom remembers this conversation and can explain Finance, People, attendance, leave, Taskboard, Schedule, subscriptions, and Flow from current app records.</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={busy || configLoading || !!configError} onClick={() => void viewFacts()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-600"><FileText className="h-4 w-4" />View available facts</button><div className="flex gap-2"><button type="button" aria-pressed={listening} disabled={busy || !config?.enabled} onClick={listen} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-600 ${listening ? 'border-red-300 bg-red-50 text-red-700' : ''}`}>{listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}{listening ? 'Listening…' : 'Speak to Vyom'}</button><button type="button" aria-label={voiceEnabled ? 'Mute Vyom' : 'Enable Vyom voice'} onClick={() => { window.speechSynthesis?.cancel(); setVoiceEnabled(value => !value) }} className="rounded-lg border p-2.5 dark:border-gray-600">{voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button><button disabled={busy || !config?.enabled || question.trim().length < 3} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Send className="h-4 w-4" />{busy ? 'Working…' : 'Ask Vyom'}</button></div></div>
      {voiceError && <p role="alert" className="mt-3 text-xs text-red-700 dark:text-red-300">{voiceError}</p>}
    </form>
    <div className="flex flex-wrap gap-2">{examples.map(example => <button type="button" disabled={busy} key={example} onClick={() => setQuestion(example)} className="rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-blue-400 dark:border-gray-600 dark:text-slate-300">{example}</button>)}</div>
    {error && <p role="alert" className="rounded-lg border border-red-200 p-4 text-sm text-red-700 dark:border-red-900 dark:text-red-300">{error}</p>}
    {answer && preview && <article aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><h4 className="font-semibold">Available workspace facts</h4><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Retrieved {new Date(answer.retrievedAt).toLocaleTimeString()}</p><ol className="mt-4 space-y-4">{answer.facts.map((fact, index) => <li key={fact.id} className="rounded-lg bg-slate-50 p-4 dark:bg-gray-900/50"><p className="text-sm leading-6">{fact.text}</p><Link to={fact.source.href} className="mt-2 inline-block text-xs text-blue-700 underline dark:text-blue-300">[{index + 1}] {fact.source.label}</Link></li>)}</ol></article>}
  </section>
}
