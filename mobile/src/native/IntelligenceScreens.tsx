import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../auth/AuthContext'
import { request } from '../api'
import { useRemote } from '../hooks/useRemote'
import { colors, currency, shortDate } from '../theme'
import { modules, sourceRoute, type Row } from './domain'
import { Button, Chips, Empty, Icon, LoadState, Panel, Section, Tag, s } from './Ui'
import type { RootStack } from './navigation'
function SourceLink({ href, label }: { href: string; label: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>(), destination = sourceRoute(href)
  return destination ? <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Records', destination)} style={{ flexDirection: 'row', gap: 7, paddingVertical: 10 }}><Icon name="document-text-outline" size={16} color={colors.accent} /><Text style={[s.link, { flex: 1 }]}>{label}</Text><Icon name="chevron-forward" size={15} color={colors.accent} /></Pressable> : <Text style={s.caption}>{label}</Text>
}
export function AskAIScreen() {
  const { user, token, serverUrl } = useAuth(), admin = user?.role === 'admin'
  const config = useRemote<Row>(admin ? '/flow/ask/config' : null)
  const [question, setQuestion] = useState(''), [period, setPeriod] = useState('month'), [busy, setBusy] = useState(false), [answer, setAnswer] = useState<Row | null>(null), [error, setError] = useState(''), [asked, setAsked] = useState(''), [connection, setConnection] = useState('')
  const pending = useRef(false)
  if (!admin) return <Empty title="Admin access required" />
  const run = async (mode: 'ask' | 'facts' | 'test') => {
    if (pending.current || (mode === 'ask' && (!config.data?.enabled || question.trim().length < 3))) return
    pending.current = true; setBusy(true); setError('')
    if (mode !== 'test') { setAnswer(null); setAsked(mode === 'ask' ? question.trim() : 'Available workspace facts') }
    try {
      const result = await request<Row>(serverUrl, mode === 'facts' ? `/flow/ask/context?period=${period}` : mode === 'test' ? '/flow/ask/test' : '/flow/ask', token, mode === 'facts' ? undefined : { method: 'POST', body: JSON.stringify(mode === 'test' ? {} : { question: question.trim(), period }) })
      if (mode === 'test') setConnection(result.message); else setAnswer(result)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not answer this question.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={95}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}><View style={{ padding: 20, borderRadius: 25, backgroundColor: colors.softBlue }}><Icon name="sparkles-outline" size={36} color={colors.accent} /></View><Text style={s.title}>Vyom</Text><Text style={[s.caption, { textAlign: 'center' }]}>Answers from your financial records, with sources.</Text></View>
    <LoadState loading={config.loading && !config.data} error={config.error} retry={config.refresh} />
    {config.data && !config.data.enabled && <Panel><Text style={[s.valueText, { color: colors.amber }]}>AI connection not configured</Text><Text style={s.caption}>The workspace server needs a model connection. You can still view verified facts below.</Text></Panel>}
    <Chips value={period} onChange={value => { if (!busy) { setPeriod(value); setAnswer(null) } }} items={[{ id: 'month', label: 'This month' }, { id: 'last_month', label: 'Last month' }, { id: 'year', label: 'This year' }]} />
    <Panel><Text style={s.sectionTitle}>Your question</Text><TextInput accessibilityLabel="Your question" value={question} editable={!busy} onChangeText={setQuestion} maxLength={1000} multiline placeholder="How much have we spent?" placeholderTextColor={colors.muted} style={{ minHeight: 110, color: colors.ink, fontSize: 16, textAlignVertical: 'top', lineHeight: 24 }} /><Button icon="arrow-up" label="Ask Vyom" busy={busy} disabled={!config.data?.enabled || question.trim().length < 3} onPress={() => void run('ask')} /></Panel>
    <Text style={s.caption}>Try a question</Text><View style={{ gap: 8 }}>{['How much have we spent?', 'Which vendors account for the most spending?', 'What are the largest expenses?', 'How much was received in deposits?'].map(example => <Pressable accessibilityRole="button" key={example} disabled={busy} onPress={() => setQuestion(example)} style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', padding: 14 }}><Text style={s.valueText}>{example}</Text></Pressable>)}</View>
    <Button secondary icon="document-text-outline" label="View available facts" disabled={busy} onPress={() => void run('facts')} />
    {!!error && <Text accessibilityRole="alert" style={s.errorText}>{error}</Text>}
    {answer && <Panel><Text style={s.sectionTitle}>{asked}</Text><Text style={s.caption}>{shortDate(answer.start)} – {shortDate(answer.end)}</Text>{answer.message && <Text style={s.valueText}>{answer.message}</Text>}{answer.facts?.map((fact: Row) => <View key={fact.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}><Text style={[s.valueText, { lineHeight: 25 }]}>{fact.text}</Text><SourceLink href={fact.source.href} label={fact.source.label} /></View>)}{answer.coverage?.map((line: string) => <Text key={line} style={s.caption}>{line}</Text>)}</Panel>}
    {config.data?.enabled && <><Button secondary label="Test model connection" disabled={busy} onPress={() => void run('test')} />{!!connection && <Text style={s.caption}>{connection}</Text>}</>}
    <Text style={s.caption}>Each question is independent. Supported: recorded spending, deposits, category/vendor rankings and largest expenses. Read-only; no predictions or record changes.</Text>
  </ScrollView></KeyboardAvoidingView>
}
export function FlowScreen() {
  const { user } = useAuth(), nav = useNavigation<NativeStackNavigationProp<RootStack>>(), admin = user?.role === 'admin'
  const checks = useRemote<Row>(admin ? '/flow/intelligence' : null), [expanded, setExpanded] = useState<string | null>(null)
  if (!admin) return <Empty title="Admin access required" />
  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={checks.loading} onRefresh={checks.refresh} />}>
    <Text style={s.title}>Workspace intelligence</Text><Text style={s.caption}>Review signals, plan ahead, and ask about your records.</Text><Button icon="sparkles-outline" label="Open Vyom" onPress={() => nav.navigate('AskAI')} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{modules.filter(module => module.group === 'flow').map(module => <Pressable accessibilityRole="button" key={module.id} onPress={() => nav.navigate('Records', { module: module.id })} style={{ width: '47%', flexGrow: 1, backgroundColor: '#fff', padding: 18, borderRadius: 20, gap: 14, borderWidth: 1, borderColor: colors.border }}><Icon name={module.icon} color={colors.accent} /><Text style={[s.valueText, { fontWeight: '700' }]}>{module.title}</Text></Pressable>)}</View>
    <Section title="Evidence-based checks" /><LoadState loading={checks.loading && !checks.data} error={checks.error} retry={checks.refresh} />
    {checks.data && <><Text style={s.caption}>Reviewed {checks.data.recordsReviewed} active expenses · {shortDate(checks.data.windowStart)} – {shortDate(checks.data.generatedAt)}</Text>{checks.data.anomalyCheck === 'insufficient_history' && <Panel><Text style={[s.valueText, { color: colors.amber }]}>More history needed</Text><Text style={s.caption}>Large-expense checks need 10 positive expenses in the historical 60-day baseline. Currently available: {checks.data.historyCount}. No anomaly conclusion is drawn from insufficient history.</Text></Panel>}
      {checks.data.signals?.map((signal: Row) => <Panel key={signal.id}><Tag value={signal.severity} /><Pressable accessibilityRole="button" onPress={() => setExpanded(expanded === signal.id ? null : signal.id)}><Text style={s.sectionTitle}>{signal.title}</Text><Text style={s.caption}>{signal.explanation}</Text><Text style={[s.link, { marginTop: 12 }]}>{expanded === signal.id ? 'Hide evidence' : 'View evidence'}</Text></Pressable>{expanded === signal.id && <><Text style={s.valueText}>{signal.action}</Text><Text style={s.caption}>{signal.method}</Text>{signal.evidence?.map((row: Row, index: number) => <SourceLink key={index} href={row.href} label={`${row.label} · ${currency(row.amount)}`} />)}</>}</Panel>)}
      {!checks.data.signals?.length && <Panel><Text style={s.sectionTitle}>No review signals</Text><Text style={s.caption}>Coverage is limited to these checks and this time window. This does not guarantee error-free records.</Text></Panel>}
      <Section title="Upcoming ledger payments" /><Panel><Text style={s.title}>{currency(checks.data.upcomingTotal)}</Text><Text style={s.caption}>Next 30 days · recurring ledger expenses</Text>{checks.data.upcoming?.map((row: Row, index: number) => <SourceLink key={index} href={row.href} label={`${row.label} · ${shortDate(row.date)}`} />)}</Panel>
    </>}
  </ScrollView>
}
