import { useEffect, useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, NativeEventEmitter, NativeModules, PermissionsAndroid, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../auth/AuthContext'
import { request } from '../api'
import { useRemote } from '../hooks/useRemote'
import { useMobileTheme, colors, currency, shortDate } from '../theme'
import { modules, sourceRoute, type Row } from './domain'
import { Button, Empty, Icon, LoadState, Panel, Section, Tag, s } from './Ui'
import type { RootStack } from './navigation'
function SourceLink({ href, label }: { href: string; label: string }) {
  useMobileTheme()

  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>(), destination = sourceRoute(href)
  return destination ? <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Records', destination)} style={{ flexDirection: 'row', gap: 7, paddingVertical: 10 }}><Icon name="document-text-outline" size={16} color={colors.accent} /><Text style={[s.link, { flex: 1 }]}>{label}</Text><Icon name="chevron-forward" size={15} color={colors.accent} /></Pressable> : <Text style={s.caption}>{label}</Text>
}
export function AskAIScreen() {
  useMobileTheme()

  const { user, token, serverUrl } = useAuth(), admin = user?.role === 'admin'
  const config = useRemote<Row>(admin ? '/flow/ask/config' : null)
  const [question, setQuestion] = useState(''), [period, setPeriod] = useState('month'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [messages, setMessages] = useState<Row[]>([])
  const [conversations, setConversations] = useState<Row[]>([]), [conversationId, setConversationId] = useState<number | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false), [historyLoading, setHistoryLoading] = useState(false)
  const [listening, setListening] = useState(false), [voiceEnabled, setVoiceEnabled] = useState(true)
  const pending = useRef(false)
  const chatScroll = useRef<ScrollView>(null)
  const run = async (spokenPrompt?: string) => {
    const prompt = (spokenPrompt ?? question).trim()
    if (pending.current || !config.data?.enabled || prompt.length < 3) return
    pending.current = true; setBusy(true); setError('')
    const history = messages.slice(-12).map(message => ({ role: message.role, content: message.content }))
    setMessages(current => [...current, { role: 'user', content: prompt }]); setQuestion('')
    try {
      const result = await request<Row>(serverUrl, '/flow/ask', token, { method: 'POST', body: JSON.stringify({ question: prompt, period, history, ...(conversationId ? { conversationId } : {}) }) })
      setMessages(current => [...current, { role: 'assistant', content: result.message || 'Here is what I found.', evidence: result }])
      if (voiceEnabled) void NativeModules.VyomVoice?.speak(result.message || result.facts?.map((fact: Row) => fact.text).join(' ') || '')
      if (result.conversationId) setConversationId(result.conversationId)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not answer this question.'); setQuestion(prompt) }
    finally { pending.current = false; setBusy(false) }
  }
  useEffect(() => {
    const voice = NativeModules.VyomVoice
    if (!voice) return
    const events = new NativeEventEmitter(voice)
    const result = events.addListener('VyomVoiceResult', ({ value }: { value: string }) => { setListening(false); setQuestion(value); if (value.trim()) void run(value) })
    const failure = events.addListener('VyomVoiceError', ({ value }: { value: string }) => { setListening(false); const messages: Record<string, string> = { ERROR_AUDIO: 'The microphone could not be opened. Check microphone access and try again.', ERROR_INSUFFICIENT_PERMISSIONS: 'Microphone permission is required to speak with Vyom.', ERROR_NO_MATCH: 'No speech was detected. Try speaking closer to the microphone.', ERROR_NETWORK: 'Voice recognition could not reach the recognition service. Check your connection and retry.', ERROR_RECOGNIZER_BUSY: 'Voice recognition is busy. Wait a moment and try again.' }; setError(messages[value] || 'Voice recognition failed. Check microphone access and try again.') })
    return () => { result.remove(); failure.remove(); voice.stopListening(); voice.stopSpeaking() }
  }, [config.data?.enabled, period, messages, voiceEnabled])
  useEffect(() => {
    if (!admin) return
    void request<Row[]>(serverUrl, '/flow/ask/conversations', token).then(rows => {
      setConversations(rows)
      if (rows[0]) { setConversationId(rows[0].id); setMessages(rows[0].messages || []); setPeriod(rows[0].period || 'month') }
    }).catch(() => undefined)
  }, [admin, serverUrl, token])
  const newConversation = async () => {
    try { const row = await request<Row>(serverUrl, '/flow/ask/conversations', token, { method: 'POST', body: JSON.stringify({ period }) }); setConversations(current => [row, ...current]); setConversationId(row.id); setMessages([]); setQuestion(''); setHistoryOpen(false) }
    catch { setError('Could not start a new conversation.') }
  }
  const deleteConversation = async () => {
    if (!conversationId) return
    try {
      await request(serverUrl, `/flow/ask/conversations/${conversationId}`, token, { method: 'DELETE' })
      const remaining = conversations.filter(row => row.id !== conversationId)
      setConversations(remaining); setConversationId(remaining[0]?.id || null); setMessages(remaining[0]?.messages || [])
    } catch { setError('Could not delete this conversation.') }
  }
  const openHistory = async () => {
    if (busy) return
    setHistoryOpen(true); setHistoryLoading(true)
    try { setConversations(await request<Row[]>(serverUrl, '/flow/ask/conversations', token)) }
    catch { setError('Could not load previous conversations.') }
    finally { setHistoryLoading(false) }
  }
  const selectConversation = (row: Row) => {
    setConversationId(row.id); setMessages(row.messages || []); setPeriod(row.period || 'month'); setQuestion(''); setError(''); setHistoryOpen(false)
  }
  const reviewProposal = async (proposal: Row, decision: 'approve' | 'reject') => {
    if (busy || proposal.status !== 'pending') return
    setBusy(true); setError('')
    try {
      const updated = await request<Row>(serverUrl, `/flow/ask/proposals/${proposal.id}/${decision}`, token, { method: 'POST', body: '{}' })
      setMessages(current => current.map(message => message.evidence?.proposal?.id === proposal.id ? { ...message, evidence: { ...message.evidence, proposal: updated } } : message))
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not review this proposal.') }
    finally { setBusy(false) }
  }
  const listen = async () => {
    if (!NativeModules.VyomVoice) { setError('Voice mode is unavailable on this device.'); return }
    if (listening) { NativeModules.VyomVoice.stopListening(); setListening(false); return }
    if (Platform.OS === 'android') {
      const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, { title: 'Talk to Vyom', message: 'Teinco-X uses the microphone only while you speak to Vyom.', buttonPositive: 'Allow', buttonNegative: 'Cancel' })
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) { setError('Microphone permission is required to speak with Vyom.'); return }
    }
    setError(''); setListening(true)
    try { await NativeModules.VyomVoice.startListening() } catch { setListening(false); setError('Voice recognition is unavailable on this device.') }
  }
  if (!admin) return <Empty title="Admin access required" />
  const activeConversation = conversations.find(row => row.id === conversationId)
  return <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={95}>
    <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softBlue }}><Icon name="sparkles" size={22} color={colors.accent} /></View>
        <View style={{ flex: 1 }}><Text style={[s.sectionTitle, { fontSize: 20 }]}>Vyom</Text><Text style={[s.caption, { marginTop: 0 }]} numberOfLines={1}>{activeConversation?.title || 'New conversation'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous conversations" onPress={() => void openHistory()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="time-outline" color={colors.primary} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="New conversation" onPress={() => void newConversation()} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="create-outline" color={colors.primary} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Delete conversation" disabled={!conversationId || busy} onPress={() => Alert.alert('Delete conversation?', 'This removes the saved Vyom conversation.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void deleteConversation() }])} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: !conversationId || busy ? .4 : 1 }}><Icon name="trash-outline" color={colors.muted} /></Pressable>
      </View>
    </View>
    <ScrollView ref={chatScroll} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }} onContentSizeChange={() => { if (messages.length) chatScroll.current?.scrollToEnd({ animated: true }) }}>
      <LoadState loading={config.loading && !config.data} error={config.error} retry={config.refresh} />
      {config.data && !config.data.enabled && <Panel><Text style={[s.valueText, { color: colors.amber }]}>AI connection not configured</Text><Text style={s.caption}>The workspace server needs a model connection.</Text></Panel>}
      {!messages.length && <View style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}><View style={{ padding: 16, borderRadius: 22, backgroundColor: colors.softBlue }}><Icon name="sparkles-outline" size={30} color={colors.accent} /></View><Text style={s.title}>Ask Vyom</Text><Text style={[s.caption, { textAlign: 'center', maxWidth: 290 }]}>Ask about your workspace, its features, or a general topic.</Text></View>}
      {!!messages.length && <View style={{ gap: 12 }}>{messages.map((message, index) => <View key={index} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%', borderRadius: 18, padding: 14, backgroundColor: message.role === 'user' ? colors.accent : colors.surface, borderWidth: message.role === 'assistant' ? 1 : 0, borderColor: colors.border }}><Text style={[s.valueText, message.role === 'user' && { color: colors.onPrimary }]}>{message.content}</Text>{message.evidence?.facts?.map((fact: Row) => <View key={fact.id} style={{ paddingTop: 12 }}><Text style={s.valueText}>{fact.text}</Text><SourceLink href={fact.source.href} label={fact.source.label} /></View>)}</View>)}</View>}
      {busy && <Text style={s.caption}>Vyom is thinking…</Text>}
      {messages.flatMap(message => message.evidence?.proposal ? [message.evidence.proposal] : []).map((proposal: Row) => <Panel key={proposal.id}><Text style={s.sectionTitle}>Approval required · {String(proposal.action).replace(/_/g, ' ')}</Text><Text style={s.caption}>Target: {proposal.targetRef || 'new record'} · Status: {proposal.status}</Text><Text style={s.caption}>Before</Text><Text style={s.valueText}>{proposal.beforeValue ? JSON.stringify(proposal.beforeValue, null, 2) : 'New record'}</Text><Text style={s.caption}>Proposed change</Text><Text style={s.valueText}>{JSON.stringify(proposal.payload, null, 2)}</Text>{proposal.status === 'pending' && <><Button label="Approve and execute" busy={busy} onPress={() => void reviewProposal(proposal, 'approve')} /><Button secondary label="Reject" disabled={busy} onPress={() => void reviewProposal(proposal, 'reject')} /></>}{proposal.failureReason && <Text style={s.errorText}>{proposal.failureReason}</Text>}</Panel>)}
      {!!error && <Text accessibilityRole="alert" style={s.errorText}>{error}</Text>}
    </ScrollView>
    <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingLeft: 12, paddingRight: 5, paddingVertical: 5, backgroundColor: colors.background }}>
        <TextInput selectionColor={colors.primary} accessibilityLabel="Message Vyom" value={question} editable={!busy} onChangeText={setQuestion} maxLength={1000} multiline placeholder="Message Vyom…" placeholderTextColor={colors.muted} style={{ flex: 1, minHeight: 42, maxHeight: 120, color: colors.ink, fontSize: 16, textAlignVertical: 'center', lineHeight: 22 }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={busy || !config.data?.enabled || question.trim().length < 3} onPress={() => void run()} style={{ width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, opacity: busy || !config.data?.enabled || question.trim().length < 3 ? .45 : 1 }}><Icon name="arrow-up" color={colors.onPrimary} size={22} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={listening ? 'Stop listening' : 'Speak to Vyom'} disabled={busy || !config.data?.enabled} onPress={() => void listen()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 8, opacity: busy || !config.data?.enabled ? .5 : 1 }}><Icon name={listening ? 'mic-off-outline' : 'mic-outline'} color={colors.primary} size={18} /><Text style={s.link}>{listening ? 'Listening…' : 'Speak'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={voiceEnabled ? 'Turn voice responses off' : 'Turn voice responses on'} onPress={() => { NativeModules.VyomVoice?.stopSpeaking(); setVoiceEnabled(value => !value) }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 8 }}><Icon name={voiceEnabled ? 'volume-high-outline' : 'volume-mute-outline'} color={colors.muted} size={18} /><Text style={s.caption}>{voiceEnabled ? 'Voice on' : 'Voice off'}</Text></Pressable>
      </View>
    </View>
    <Modal visible={historyOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHistoryOpen(false)}>
      <View style={[s.page, { padding: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}><Text style={s.title}>Previous conversations</Text><Pressable accessibilityRole="button" accessibilityLabel="Close previous conversations" onPress={() => setHistoryOpen(false)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" color={colors.primary} /></Pressable></View>
        {historyLoading && <Text style={s.caption}>Loading conversations…</Text>}
        <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 30 }}>
          {!historyLoading && !conversations.length && <Text style={s.caption}>No previous conversations yet.</Text>}
          {conversations.map(row => <Pressable key={row.id} accessibilityRole="button" accessibilityState={{ selected: row.id === conversationId }} onPress={() => selectConversation(row)} style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: row.id === conversationId ? colors.primary : colors.border, backgroundColor: colors.surface, gap: 5 }}><Text numberOfLines={2} style={s.sectionTitle}>{row.title || 'New conversation'}</Text><Text style={s.caption}>{row.messages?.length || 0} messages · {shortDate(row.updatedAt)}</Text></Pressable>)}
        </ScrollView>
      </View>
    </Modal>
  </KeyboardAvoidingView>
}
export function FlowScreen() {
  useMobileTheme()

  const { user } = useAuth(), nav = useNavigation<NativeStackNavigationProp<RootStack>>(), admin = user?.role === 'admin'
  const checks = useRemote<Row>(admin ? '/flow/intelligence' : null), [expanded, setExpanded] = useState<string | null>(null)
  if (!admin) return <Empty title="Admin access required" />
  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surface} refreshing={checks.loading} onRefresh={checks.refresh} />}>
    <Text style={s.title}>Workspace intelligence</Text><Text style={s.caption}>Review signals, plan ahead, and ask about your records.</Text><Button icon="sparkles-outline" label="Open Vyom" onPress={() => nav.navigate('AskAI')} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{modules.filter(module => module.group === 'flow').map(module => <Pressable accessibilityRole="button" key={module.id} onPress={() => nav.navigate('Records', { module: module.id })} style={{ width: '47%', flexGrow: 1, backgroundColor: colors.surface, padding: 18, borderRadius: 20, gap: 14, borderWidth: 1, borderColor: colors.border }}><Icon name={module.icon} color={colors.accent} /><Text style={[s.valueText, { fontWeight: '700' }]}>{module.title}</Text></Pressable>)}</View>
    <Section title="Evidence-based checks" /><LoadState loading={checks.loading && !checks.data} error={checks.error} retry={checks.refresh} />
    {checks.data && <><Text style={s.caption}>Reviewed {checks.data.recordsReviewed} active expenses · {shortDate(checks.data.windowStart)} – {shortDate(checks.data.generatedAt)}</Text>{checks.data.anomalyCheck === 'insufficient_history' && <Panel><Text style={[s.valueText, { color: colors.amber }]}>More history needed</Text><Text style={s.caption}>Large-expense checks need 10 positive expenses in the historical 60-day baseline. Currently available: {checks.data.historyCount}. No anomaly conclusion is drawn from insufficient history.</Text></Panel>}
      {checks.data.signals?.map((signal: Row) => <Panel key={signal.id}><Tag value={signal.severity} /><Pressable accessibilityRole="button" onPress={() => setExpanded(expanded === signal.id ? null : signal.id)}><Text style={s.sectionTitle}>{signal.title}</Text><Text style={s.caption}>{signal.explanation}</Text><Text style={[s.link, { marginTop: 12 }]}>{expanded === signal.id ? 'Hide evidence' : 'View evidence'}</Text></Pressable>{expanded === signal.id && <><Text style={s.valueText}>{signal.action}</Text><Text style={s.caption}>{signal.method}</Text>{signal.evidence?.map((row: Row, index: number) => <SourceLink key={index} href={row.href} label={`${row.label} · ${currency(row.amount)}`} />)}</>}</Panel>)}
      {!checks.data.signals?.length && <Panel><Text style={s.sectionTitle}>No review signals</Text><Text style={s.caption}>Coverage is limited to these checks and this time window. This does not guarantee error-free records.</Text></Panel>}
      <Section title="Upcoming ledger payments" /><Panel><Text style={s.title}>{currency(checks.data.upcomingTotal)}</Text><Text style={s.caption}>Next 30 days · recurring ledger expenses</Text>{checks.data.upcoming?.map((row: Row, index: number) => <SourceLink key={index} href={row.href} label={`${row.label} · ${shortDate(row.date)}`} />)}</Panel>
    </>}
  </ScrollView>
}
