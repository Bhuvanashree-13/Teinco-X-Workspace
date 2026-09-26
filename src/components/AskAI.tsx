import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Send, FileText, Mic, MicOff, Volume2, VolumeX, Plus, Trash2, PanelLeft, X, MessageSquare, Download } from 'lucide-react'
import { apiPost, useApi } from '../hooks/useApi'
declare global { interface String { replaceAll(searchValue: string, replaceValue: string): string } }
type Fact = { id: string; text: string; source: { label: string; href: string } }
type Artifact = { type: 'expense_csv'; label: string; href: string; filename: string; rowCount: number }
type Proposal = { id: number; action: string; entityType: string; targetRef?: string | null; payload: Record<string, unknown>; beforeValue?: Record<string, unknown> | null; status: string; expiresAt: string; failureReason?: string | null }
type Evidence = { facts: Fact[]; start: string; end: string; retrievedAt: string; coverage: string[]; message?: string; status?: string; scope?: 'workspace' | 'general'; artifact?: Artifact; proposal?: Proposal }
type ChatMessage = { role: 'user' | 'assistant'; content: string; evidence?: Evidence }
type Conversation = { id: number; title: string; period: string; updatedAt: string; messages: ChatMessage[] }
type SpeechRecognitionResultLike = { 0: { transcript: string }; isFinal?: boolean }
type SpeechResultEvent = { resultIndex?: number; results: { length?: number; [index: number]: SpeechRecognitionResultLike } }
type SpeechRecognitionLike = { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void; onresult: ((event: SpeechResultEvent) => void) | null; onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null }
const examples = ["What's happening in the workspace?", 'What needs my attention today?', 'How does the Taskboard work?', 'Explain compound interest simply']
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
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [listening, setListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [voiceError, setVoiceError] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const conversationEnd = useRef<HTMLDivElement | null>(null)
  const busyRef = useRef(false)
  const listeningRef = useRef(false)
  const lastVoicePrompt = useRef('')
  useEffect(() => {
    void loadConversations()
    return () => { recognition.current?.abort(); window.speechSynthesis?.cancel() }
  }, [])
  useEffect(() => { conversationEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, busy])
  async function loadConversations(preferredId?: number) {
    try {
      const token = localStorage.getItem('teinco-x-token')
      const response = await fetch('/api/flow/ask/conversations', { headers: { Authorization: `Bearer ${token || ''}` } })
      if (!response.ok) return
      const rows: Conversation[] = await response.json()
      setConversations(rows)
      const selected = rows.find(row => row.id === preferredId) || rows[0]
      if (selected) { setConversationId(selected.id); setMessages(selected.messages); setPeriod(selected.period) }
    } catch { /* A new conversation remains available if history cannot load. */ }
  }
  async function newConversation() {
    const created: Conversation = await apiPost('/flow/ask/conversations', { period })
    setConversations(current => [created, ...current]); setConversationId(created.id); setMessages([]); setAnswer(null); setQuestion('')
  }
  async function deleteConversation() {
    if (!conversationId || busy) return
    const token = localStorage.getItem('teinco-x-token')
    const response = await fetch(`/api/flow/ask/conversations/${conversationId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token || ''}` } })
    if (!response.ok) { setError('Could not delete this conversation.'); return }
    const remaining = conversations.filter(row => row.id !== conversationId)
    setConversations(remaining); setConversationId(remaining[0]?.id || null); setMessages(remaining[0]?.messages || []); setAnswer(null)
  }
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
    if (busyRef.current || !promptValue.trim() || !config?.enabled) return
    const prompt = promptValue.trim(), history = messages.slice(-12).map(({ role, content }) => ({ role, content }))
    busyRef.current = true; setBusy(true); setError(''); setAnswer(null); setPreview(false); setMessages(current => [...current, { role: 'user', content: prompt }]); setQuestion('')
    try { const result: Evidence & { conversationId: number } = await apiPost('/flow/ask', { question: prompt, period, history, ...(conversationId ? { conversationId } : {}) }); setConversationId(result.conversationId); setAnswer(result); setMessages(current => [...current, { role: 'assistant', content: result.message || 'Here is what I found.', evidence: result }]); speak(result); void loadConversations(result.conversationId) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not answer this question.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  async function submit(event: FormEvent) { event.preventDefault(); await ask(question) }
  async function downloadArtifact(artifact: Artifact) {
    try {
      const token = localStorage.getItem('teinco-x-token')
      const response = await fetch(artifact.href, { headers: { Authorization: `Bearer ${token || ''}` } })
      if (!response.ok) throw new Error('Download failed')
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a')
      link.href = url; link.download = artifact.filename; link.click(); URL.revokeObjectURL(url)
    } catch { setError('Could not download the expense sheet. Please try again.') }
  }
  async function reviewProposal(proposal: Proposal, decision: 'approve' | 'reject') {
    if (busy || proposal.status !== 'pending') return
    setBusy(true); setError('')
    try {
      const updated: Proposal = await apiPost(`/flow/ask/proposals/${proposal.id}/${decision}`, {})
      setMessages(current => current.map(message => message.evidence?.proposal?.id === proposal.id ? { ...message, evidence: { ...message.evidence, proposal: updated } } : message))
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not review this proposal.') }
    finally { setBusy(false) }
  }
  function listen() {
    if (listeningRef.current) { recognition.current?.stop(); return }
    const SpeechRecognitionConstructor = (window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition
    if (!SpeechRecognitionConstructor) { setVoiceError('Voice recognition is not supported by this browser. Use Chrome or Edge.'); return }
    setVoiceError(''); lastVoicePrompt.current = ''
    const instance = new SpeechRecognitionConstructor()
    recognition.current = instance; instance.lang = 'en-IN'; instance.continuous = false; instance.interimResults = false
    instance.onresult = event => {
      const index = event.resultIndex ?? 0
      const result = event.results[index]
      if (!result || result.isFinal === false) return
      const transcript = result[0]?.transcript.trim() || ''
      if (!transcript || transcript.toLocaleLowerCase() === lastVoicePrompt.current.toLocaleLowerCase()) return
      lastVoicePrompt.current = transcript
      listeningRef.current = false
      setListening(false); setQuestion(transcript)
      void ask(transcript)
    }
    instance.onerror = event => {
      const messages: Record<string, string> = { 'not-allowed': 'Microphone permission is required to speak with Vyom.', 'audio-capture': 'No microphone was found. Check your input device and try again.', 'no-speech': 'No speech was detected. Try speaking closer to the microphone.', network: 'Voice recognition could not reach the browser service. Check your connection and retry.' }
      setVoiceError(messages[event.error || ''] || 'Voice recognition failed. Check microphone access and try again.')
    }
    instance.onend = () => { listeningRef.current = false; setListening(false) }
    listeningRef.current = true; setListening(true); instance.start()
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
  const chooseConversation = (selected: Conversation) => {
    setConversationId(selected.id); setMessages(selected.messages); setPeriod(selected.period); setAnswer(null); setError(''); setHistoryOpen(false)
  }
  return <section className="relative flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 md:flex-row" style={{ height: 'calc(100vh - 120px)', minHeight: '500px' }}>
    {historyOpen && <button type="button" aria-label="Close recent chats" onClick={() => setHistoryOpen(false)} className="absolute inset-0 z-20 cursor-default bg-slate-950/20 backdrop-blur-[1px] md:hidden" />}
    <aside className={`absolute inset-y-0 left-0 z-30 flex w-full flex-col border-b border-slate-200 bg-slate-50 transition-transform duration-200 dark:border-gray-700 dark:bg-gray-950 sm:w-80 md:static md:inset-auto md:border-b-0 md:border-r ${historyOpen ? 'translate-y-0' : '-translate-y-full md:translate-y-0'}`}>
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-gray-700"><p className="font-semibold text-slate-900 dark:text-white">Recent chats</p><button type="button" aria-label="Close recent chats" onClick={() => setHistoryOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button></div>
      <div className="p-3"><button type="button" onClick={() => { void newConversation(); setHistoryOpen(false) }} className="flex w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"><Plus className="h-4 w-4" />New chat</button></div>
      <nav aria-label="Recent Vyom chats" className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {!conversations.length && <p className="px-3 py-8 text-center text-sm text-slate-500">No recent chats yet.</p>}
        {conversations.map(row => <button type="button" key={row.id} onClick={() => chooseConversation(row)} className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${row.id === conversationId ? 'bg-slate-200 text-slate-950 dark:bg-gray-800 dark:text-white' : 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-gray-800'}`}><MessageSquare className="mt-0.5 h-4 w-4 shrink-0" /><span className="min-w-0"><span className="block truncate font-medium">{row.title}</span><span className="mt-0.5 block text-xs text-slate-500">{new Date(row.updatedAt).toLocaleDateString()}</span></span></button>)}
      </nav>
      <div className="border-t border-slate-200 p-3 dark:border-gray-700"><button type="button" disabled={!conversationId || busy} onClick={() => void deleteConversation()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" />Delete current chat</button></div>
    </aside>

    <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-gray-700 md:justify-center">
      <button type="button" aria-label="Open recent chats" onClick={() => setHistoryOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-gray-800 md:hidden"><PanelLeft className="h-5 w-5" /></button>
      <div className="flex flex-1 items-center justify-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white"><Bot className="h-4 w-4" /></span><div className="hidden sm:block"><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Vyom</h3><p className="text-[11px] text-emerald-600 dark:text-emerald-400">{config?.enabled ? 'Online' : 'Unavailable'}</p></div></div>
      <button type="button" aria-label="Start a new chat" onClick={() => void newConversation()} className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-gray-800 md:hidden"><Plus className="h-5 w-5" /></button>
    </header>

    <div className="flex flex-1 flex-col overflow-hidden">
      <div aria-live="polite" className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 md:px-8">
        <div className="mx-auto w-full max-w-2xl space-y-4 sm:space-y-6">
          <div className="flex items-start gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900"><Bot className="h-4 w-4" /></span><div className="max-w-2xl rounded-2xl rounded-tl-md bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-800 dark:bg-gray-800 dark:text-slate-100"><p className="font-medium">Hi, I’m Vyom.</p><p>I can reason about your workspace, explain every feature, or help with general questions. Workspace answers stay read-only and source-backed.</p></div></div>
          {!messages.length && <div className="grid gap-2 pl-0 sm:grid-cols-2 sm:pl-11">{examples.slice(0, 4).map(example => <button type="button" disabled={busy} key={example} onClick={() => setQuestion(example)} className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:bg-blue-950/30">{example}</button>)}</div>}
          {messages.map((message, index) => message.role === 'user'
            ? <div key={index} className="flex justify-end"><div className="max-w-[90%] rounded-2xl rounded-br-md bg-blue-600 px-3 py-2 text-sm leading-5 text-white sm:max-w-[80%] sm:px-4 sm:py-3 sm:leading-6">{message.content}</div></div>
            : <div key={index} className="flex items-start gap-2 sm:gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 sm:h-8 sm:w-8"><Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span><div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-800 dark:bg-gray-800 dark:text-slate-100 sm:max-w-2xl sm:px-4 sm:py-3 sm:text-sm sm:leading-6">{message.evidence?.scope && <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{message.evidence.scope === 'workspace' ? 'Workspace analysis' : 'General knowledge'}</p>}<p className="whitespace-pre-wrap">{message.content}</p>{message.evidence?.proposal && <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30"><p className="font-semibold">Approval required · {message.evidence.proposal.action.replaceAll('_', ' ')}</p><p className="text-xs text-slate-600 dark:text-slate-300">Target: {message.evidence.proposal.targetRef || 'new record'} · Status: {message.evidence.proposal.status}</p>{message.evidence.proposal.beforeValue && <details className="mt-2"><summary className="cursor-pointer text-xs font-medium">Before</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(message.evidence.proposal.beforeValue, null, 2)}</pre></details>}<details className="mt-2" open><summary className="cursor-pointer text-xs font-medium">Proposed change</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(message.evidence.proposal.payload, null, 2)}</pre></details>{message.evidence.proposal.status === 'pending' && <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void reviewProposal(message.evidence!.proposal!, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white disabled:opacity-50">Approve and execute</button><button type="button" disabled={busy} onClick={() => void reviewProposal(message.evidence!.proposal!, 'reject')} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-50">Reject</button></div>}{message.evidence.proposal.failureReason && <p className="mt-2 text-xs text-red-700">{message.evidence.proposal.failureReason}</p>}</div>}{message.evidence?.artifact && <button type="button" onClick={() => void downloadArtifact(message.evidence!.artifact!)} className="mt-3 flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"><Download className="h-4 w-4" />{message.evidence.artifact.label}<span className="text-xs text-blue-100">({message.evidence.artifact.rowCount} rows)</span></button>}{message.evidence?.facts.map((fact, factIndex) => <div key={fact.id} className="mt-3 border-t border-slate-200 pt-3 dark:border-gray-700"><p>{fact.text}</p><Link to={fact.source.href} className="mt-1 inline-block text-xs font-medium text-blue-700 underline dark:text-blue-300">[{factIndex + 1}] {fact.source.label}</Link></div>)}</div></div>)}
          {busy && <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900"><Bot className="h-4 w-4" /></span><div role="status" className="flex gap-1 rounded-2xl rounded-tl-md bg-slate-100 px-4 py-4 dark:bg-gray-800"><span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" /><span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:120ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:240ms]" /></div></div>}
          {answer && preview && <article className="ml-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:ml-11 dark:border-gray-700 dark:bg-gray-800"><h4 className="font-semibold">Available workspace facts</h4><p className="mt-1 text-xs text-slate-500">Retrieved {new Date(answer.retrievedAt).toLocaleTimeString()}</p><ol className="mt-3 space-y-3">{answer.facts.map((fact, index) => <li key={fact.id} className="text-sm leading-6"><p>{fact.text}</p><Link to={fact.source.href} className="text-xs font-medium text-blue-700 underline dark:text-blue-300">[{index + 1}] {fact.source.label}</Link></li>)}</ol></article>}
          <div ref={conversationEnd} />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-3 py-3 dark:border-gray-700 dark:bg-gray-900 sm:px-6 md:px-8">
        <div className="mx-auto w-full max-w-2xl">
          {configLoading ? <p role="status" className="mb-2 text-[11px] text-slate-500 sm:text-xs">Checking model availability…</p> : configError ? <p role="alert" className="mb-2 text-[11px] text-red-700 dark:text-red-300 sm:text-xs">Could not check Vyom configuration. <button onClick={() => void refetch()} className="underline">Retry</button></p> : !config?.enabled && <p className="mb-2 text-[11px] text-amber-700 dark:text-amber-300 sm:text-xs">Vyom needs a model connection. You can still view verified workspace facts.</p>}
          {error && <p role="alert" className="mb-2 text-[11px] text-red-700 dark:text-red-300 sm:text-xs">{error}</p>}
          <form onSubmit={submit} className="rounded-xl border border-slate-300 bg-white p-1.5 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:border-gray-600 dark:bg-gray-800 dark:focus-within:ring-blue-950 sm:rounded-2xl sm:p-2">
            <textarea aria-label="Message Vyom" required minLength={3} maxLength={1000} rows={2} disabled={busy} value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder="Ask Vyom…" className="max-h-32 min-h-10 w-full resize-none bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-slate-400 dark:text-white sm:max-h-36 sm:min-h-12 sm:px-2 sm:py-2 sm:text-sm" />
            <div className="flex flex-col gap-1 border-t border-slate-100 pt-1.5 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:pt-2">
              <div className="flex items-center gap-0.5 sm:gap-1">
                <select aria-label="Reporting period" disabled={busy} value={period} onChange={event => { setPeriod(event.target.value); setAnswer(null); setError('') }} className="rounded-lg border-0 bg-slate-100 px-1.5 py-1 text-[10px] dark:bg-gray-700 sm:px-2 sm:py-1.5 sm:text-xs">
                  <option value="month">MTD</option>
                  <option value="last_month">Last month</option>
                  <option value="year">YTD</option>
                </select>
                <button type="button" aria-label="View available facts" disabled={busy || configLoading || !!configError} onClick={() => void viewFacts()} className="grid h-7 w-7 place-items-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-gray-700 sm:h-8 sm:w-8 sm:p-2">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button type="button" aria-label={listening ? 'Stop listening' : 'Speak to Vyom'} aria-pressed={listening} disabled={busy || !config?.enabled} onClick={listen} className={`grid h-7 w-7 place-items-center rounded-lg p-1.5 disabled:opacity-40 sm:h-8 sm:w-8 sm:p-2 ${listening ? 'bg-red-50 text-red-700 dark:bg-red-950/30' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700'}`}>
                  {listening ? <MicOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                </button>
                <button type="button" aria-label={voiceEnabled ? 'Mute Vyom' : 'Enable Vyom voice'} onClick={() => { window.speechSynthesis?.cancel(); setVoiceEnabled(value => !value) }} className="grid h-7 w-7 place-items-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700 sm:h-8 sm:w-8 sm:p-2">
                  {voiceEnabled ? <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                </button>
                <button aria-label="Send message" disabled={busy || !config?.enabled || question.trim().length < 3} className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 p-1.5 text-white disabled:bg-slate-300 dark:disabled:bg-gray-700 sm:h-8 sm:w-8 sm:p-2">
                  <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>
          </form>
          <div className="mt-1.5 flex flex-col items-start justify-between gap-1 px-1 sm:flex-row sm:items-center sm:gap-3 sm:mt-2"><p className="text-[10px] text-slate-500 sm:text-[11px]">Vyom combines workspace context with reasoning.</p><button type="button" disabled={testing || !config?.enabled} onClick={() => void testConnection()} className="text-[10px] text-slate-500 underline disabled:opacity-40 sm:text-[11px]">{testing ? 'Testing…' : connection || 'Test connection'}</button></div>
          {voiceError && <p role="alert" className="mt-1.5 text-[11px] text-red-700 dark:text-red-300 sm:mt-2 sm:text-xs">{voiceError}</p>}
        </div>
      </div>
    </div>
  </section>
}
