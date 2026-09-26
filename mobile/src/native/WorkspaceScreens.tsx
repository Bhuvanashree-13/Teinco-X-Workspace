import { useEffect, useState } from 'react'
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../auth/AuthContext'
import { useRemote } from '../hooks/useRemote'
import { colors, currency, shortDate, themedStyles, useMobileTheme } from '../theme'
import { APP_VERSION } from '../update-version'
import { checkForAndroidUpdate, openAndroidUpdate } from '../updates'
import { request } from '../api'
import { modules, type Row } from './domain'
import type { RootStack } from './navigation'
import { Button, Empty, Icon, LoadState, Panel, Search, Section, s } from './Ui'
import { ProjectCard } from './ProjectCard'
import { MotionPressable, Reveal } from './Motion'
const useNav = () => useNavigation<NativeStackNavigationProp<RootStack>>()

function Action({ title, icon, color, background, onPress }: { title: string; icon: string; color: string; background: string; onPress: () => void }) {
  return <MotionPressable accessibilityLabel={title} onPress={onPress} style={w.action}><View style={[w.actionIcon, { backgroundColor: background }]}><Icon name={icon} size={24} color={color} /></View><Text style={w.actionLabel}>{title}</Text></MotionPressable>
}
function Metric({ title, value, icon }: { title: string; value: string; icon: string }) {
  return <View style={w.metric}><Icon name={icon} size={20} color={colors.accent} /><Text style={w.metricValue}>{value}</Text><Text style={s.caption}>{title}</Text></View>
}
export function HomeScreen() {
  const { theme } = useMobileTheme()
  const nav = useNav(), { user, token, serverUrl } = useAuth(), admin = user?.role === 'admin'
  const remote = useRemote<Row>(admin ? '/dashboard/kpi' : '/employees/summary')
  const recent = useRemote<Row>(admin ? '/expenses?limit=4' : null)
  const projects = useRemote<Row[]>('/projects')
  const issues = useRemote<Row[]>('/projects/issues')
  const notifications = useRemote<Row[]>(admin ? '/employees/notifications' : null)
  const data = remote.data
  const [projectOrder, setProjectOrder] = useState<Row[]>([])
  useEffect(() => { if (projects.data) setProjectOrder(projects.data.filter(project => project.status === 'active')) }, [projects.data])
  const count = notifications.data?.filter(row => row.type === 'attendance_checked_in' || row.type === 'attendance_checked_out').length || 0
  const records = (module: string) => nav.navigate('Records', { module })
  const activeProjects = projectOrder
  const moveProject = async (index: number, offset: number) => {
    const target = index + offset
    if (target < 0 || target >= activeProjects.length) return
    const previous = [...activeProjects], next = [...activeProjects]
    ;[next[index], next[target]] = [next[target], next[index]]
    setProjectOrder(next)
    try { await request(serverUrl, '/projects/order', token, { method: 'PUT', body: JSON.stringify({ projectIds: next.map(project => project.id) }) }) }
    catch { setProjectOrder(previous); Alert.alert('Order not saved', 'Could not update project priority. Please try again.') }
  }
  const palette = theme === 'light'
    ? [{ color: colors.sky, background: colors.softBlue }, { color: colors.pink, background: colors.softPink }, { color: colors.violet, background: colors.softPurple }, { color: colors.gold, background: colors.softYellow }]
    : Array.from({ length: 4 }, () => ({ color: colors.ink, background: colors.surfaceRaised }))
  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={remote.loading || projects.loading} tintColor={colors.primary} onRefresh={() => { void remote.refresh(); void recent.refresh(); void projects.refresh(); void issues.refresh(); void notifications.refresh() }} />}>
    <Reveal><View style={w.top}><View style={{ flex: 1 }}><Text style={w.brand}>Teinco-X <Text style={{ color: colors.accent }}>●</Text></Text><Text style={w.date}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text></View>{admin && <Pressable accessibilityRole="button" accessibilityLabel={`Notifications, ${count} attendance updates`} onPress={() => records('notifications')} style={w.iconButton}><Icon name="notifications-outline" />{count > 0 && <View style={w.dot} />}</Pressable>}<Pressable accessibilityRole="button" accessibilityLabel="Your account" onPress={() => nav.navigate('Account')} style={w.avatar}><Text style={w.avatarText}>{(user?.name || 'TX').split(/\s+/).map(v => v[0]).join('').slice(0, 2).toUpperCase()}</Text></Pressable></View></Reveal>
    <Reveal delay={70}><View><Text style={s.caption}>Welcome back, {user?.name?.split(' ')[0] || 'there'}</Text><Text style={w.headline}>Your day, in focus.</Text></View></Reveal>
    <Section title="Projects in action" action="All tasks" onPress={() => records('taskboard')} />
    <LoadState loading={projects.loading && !projects.data} error={projects.error || issues.error} retry={() => { void projects.refresh(); void issues.refresh() }} />
    {!projects.loading && !projects.error && (activeProjects.length ? activeProjects.map((project, index) => <Reveal key={project.id} delay={Math.min(120 + index * 70, 330)}><ProjectCard project={project} issues={issues.data} onOpen={() => nav.navigate('Records', { module: 'taskboard', query: `projectId=${project.id}` })} onAdd={admin ? () => nav.navigate('Edit', { module: 'taskboard', row: { projectId: project.id } }) : undefined} onTask={row => nav.navigate('Detail', { module: 'taskboard', row })} onMoveUp={admin && index > 0 ? () => void moveProject(index, -1) : undefined} onMoveDown={admin && index < activeProjects.length - 1 ? () => void moveProject(index, 1) : undefined} /></Reveal>) : <Empty title="No active projects" message="Active projects will appear here as soon as work begins." icon="folder-open-outline" />)}
    {(data || remote.error) && <Section title={admin ? 'Finance overview' : 'Your workday'} />}
    <LoadState loading={remote.loading && !data} error={remote.error} retry={remote.refresh} />
    {data && <>
      <Reveal delay={100}><View style={w.hero}>
        <View style={w.heroTop}><View style={w.heroBadge}><Icon name={admin ? 'wallet-outline' : 'sunny-outline'} color={colors.heroText} size={20} /></View><Text style={w.heroLabel}>{admin ? 'Available balance' : 'Your workspace'}</Text></View>
        <Text style={w.heroValue}>{admin ? currency(data.availableBalance) : 'Make today count.'}</Text>
        <Text style={w.heroNote}>{admin ? 'Received deposits less recorded expenses' : 'Your attendance, time off and work, together.'}</Text>
        {!admin && <Button label="Open attendance" icon="finger-print-outline" onPress={() => records('attendance')} />}
      </View></Reveal>
      <Reveal delay={170}><View style={w.metrics}>{admin ? <><Metric title="Spent this month" value={currency(data.currentMonthSpend)} icon="trending-up-outline" /><Metric title="Year to date" value={currency(data.currentYearSpend)} icon="calendar-outline" /></> : <><Metric title="Leave available" value={`${data.leaveBalance ?? 0} days`} icon="leaf-outline" /><Metric title="Leave requests pending" value={String(data.pendingLeave ?? 0)} icon="hourglass-outline" /></>}</View></Reveal>
      <Section title="Quick actions" />
      <View style={w.actions}>{admin ? <><Action title="Expense" icon="arrow-up-outline" {...palette[0]} onPress={() => nav.navigate('Edit', { module: 'expenses' })} /><Action title="Deposit" icon="arrow-down-outline" {...palette[1]} onPress={() => nav.navigate('Edit', { module: 'deposits' })} /><Action title="Analytics" icon="bar-chart-outline" {...palette[2]} onPress={() => nav.navigate('Analytics')} /><Action title="Ask Vyom" icon="sparkles-outline" {...palette[3]} onPress={() => nav.navigate('AskAI')} /></> : <><Action title="Attendance" icon="finger-print-outline" {...palette[0]} onPress={() => records('attendance')} /><Action title="Leave" icon="leaf-outline" {...palette[1]} onPress={() => nav.navigate('Edit', { module: 'leave' })} /><Action title="Payslips" icon="document-text-outline" {...palette[2]} onPress={() => records('payslips')} /><Action title="Tasks" icon="checkbox-outline" {...palette[3]} onPress={() => records('taskboard')} /></>}</View>
    </>}
    {admin && <><Section title="Recent activity" action="All expenses" onPress={() => records('expenses')} /><LoadState loading={recent.loading && !recent.data} error={recent.error} retry={recent.refresh} />{recent.data?.expenses?.length ? <Panel>{recent.data.expenses.map((row: Row) => <Pressable key={row.id} accessibilityRole="button" onPress={() => nav.navigate('Detail', { module: 'expenses', row })} style={w.transaction}><View style={w.transactionIcon}><Icon name="receipt-outline" size={20} /></View><View style={{ flex: 1 }}><Text style={w.rowTitle} numberOfLines={2}>{row.description}</Text><Text style={s.caption}>{shortDate(row.expenseDate)}</Text><Text style={w.amount}>{currency(row.baseCurrencyAmount)}</Text></View><Icon name="chevron-forward" color={colors.subtle} size={18} /></Pressable>)}</Panel> : !recent.loading && !recent.error && <Empty title="A fresh start" message="Your recorded expenses will appear here." />}
      <Section title="Coming up" />{data?.upcomingExpenses?.length ? <Panel>{data.upcomingExpenses.slice(0, 4).map((row: Row) => <View key={row.id} style={w.transaction}><Icon name="time-outline" color={colors.amber} /><View style={{ flex: 1 }}><Text style={w.rowTitle} numberOfLines={2}>{row.description}</Text><Text style={s.caption}>{shortDate(row.dueDate)}</Text><Text style={w.amount}>{currency(row.amount)}</Text></View></View>)}</Panel> : data && <Panel><Text style={s.caption}>No upcoming commitments in the next 30 days.</Text></Panel>}
    </>}
    {!admin && data && <Panel><Text style={w.rowTitle}>Keep work moving</Text><Text style={s.caption}>Review shared tasks, check your schedule, or follow up on a leave request.</Text><Button secondary label="Open taskboard" icon="checkbox-outline" onPress={() => records('taskboard')} /></Panel>}
  </ScrollView>
}

export function GroupScreen({ group }: { group: 'finance' | 'people' }) {
  const { theme } = useMobileTheme()
  const { user } = useAuth(), nav = useNav(), [search, setSearch] = useState('')
  const rows = modules.filter(row => row.group === group && (!row.admin || user?.role === 'admin') && row.title.toLowerCase().includes(search.toLowerCase()))
  const iconPalette = theme === 'light'
    ? [{ color: colors.sky, background: colors.softBlue }, { color: colors.violet, background: colors.softPurple }, { color: colors.pink, background: colors.softPink }, { color: colors.gold, background: colors.softYellow }]
    : Array.from({ length: 4 }, () => ({ color: colors.ink, background: colors.surfaceRaised }))
  return <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><Reveal><Text style={w.eyebrow}>{group === 'finance' ? 'MONEY & RESOURCES' : 'PEOPLE & DELIVERY'}</Text><Text style={w.headline}>{group === 'finance' ? 'Finance, organised.' : 'Better work, together.'}</Text><Text style={s.caption}>{group === 'finance' ? 'A clear view of what comes in, what goes out, and what comes next.' : 'Your team, daily routines, and shared projects.'}</Text></Reveal><Reveal delay={70}><Search value={search} onChangeText={setSearch} placeholder={`Find ${group === 'finance' ? 'finance' : 'workspace'} tools`} /></Reveal><View style={w.moduleGrid}>{rows.map((row, index) => { const tone = iconPalette[index % iconPalette.length]; return <Reveal key={row.id} delay={110 + index * 55} style={w.moduleReveal}><MotionPressable accessibilityLabel={row.title} onPress={() => nav.navigate('Records', { module: row.id })} style={w.moduleCard}><View style={[w.actionIcon, { backgroundColor: tone.background }]}><Icon name={row.icon} size={26} color={tone.color} /></View><Text style={w.rowTitle}>{row.title}</Text><Icon name="arrow-forward" color={tone.color} size={20} /></MotionPressable></Reveal> })}</View>{!rows.length && <Empty title="No matching tools" message="Try a different search." />}</ScrollView>
}

export function MoreScreen() {
  const nav = useNav(), { user } = useAuth(), { theme, setTheme } = useMobileTheme()
  const check = () => void checkForAndroidUpdate().then(update => update ? Alert.alert(`Teinco-X ${update.version}`, update.notes, [{ text: 'Later', style: 'cancel' }, { text: 'Update now', onPress: () => void openAndroidUpdate(update.downloadUrl).catch(() => Alert.alert('Could not open update', 'Please try again or open the update link in your browser.')) }]) : Alert.alert('You are up to date', `Version ${APP_VERSION}`)).catch(() => Alert.alert('Update check failed', 'Please check your connection and retry.'))
  const links = [
    { title: 'Schedule', note: 'Events, meetings and important dates', icon: 'calendar-outline', action: () => nav.navigate('Schedule') },
    { title: 'Subscriptions', note: 'Your shared tools and services', icon: 'repeat-outline', action: () => nav.navigate('Records', { module: 'subscriptions' }) },
    ...(user?.role === 'admin' ? [{ title: 'Flow & intelligence', note: 'Insights for your next decision', icon: 'sparkles-outline', action: () => nav.navigate('Flow') }, { title: 'Workspace settings', note: 'Company and reporting preferences', icon: 'settings-outline', action: () => nav.navigate('Settings') }] : []),
    { title: 'Check for updates', note: `Installed version ${APP_VERSION}`, icon: 'cloud-download-outline', action: check },
    { title: 'Account & sign out', note: 'Profile and workspace session', icon: 'person-circle-outline', action: () => nav.navigate('Account') },
  ]
  return <ScrollView style={s.page} contentContainerStyle={s.content}><Text style={w.eyebrow}>MAKE IT YOURS</Text><Text style={w.headline}>Your workspace.</Text><Panel><Text style={w.rowTitle}>{user?.name || 'Teinco-X member'}</Text><Text style={s.caption}>{user?.email}</Text><Text style={w.eyebrow}>{user?.role === 'admin' ? 'Administrator' : 'Employee'}</Text></Panel><Section title="Appearance" /><View style={w.metrics}>{(['light', 'dark'] as const).map(mode => <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected: theme === mode }} onPress={() => setTheme(mode)} style={[w.themeCard, theme === mode && { borderColor: colors.primary, borderWidth: 2 }]}><Icon name={mode === 'light' ? 'sunny-outline' : 'moon-outline'} color={colors.primary} /><Text style={w.rowTitle}>{mode === 'light' ? 'Light' : 'Dark'}</Text><Text style={s.caption}>{mode === 'light' ? 'Warm & clear' : 'Soft & focused'}</Text>{theme === mode && <Icon name="checkmark-circle" color={colors.primary} size={20} />}</Pressable>)}</View><Section title="Tools & preferences" /><Panel>{links.map(link => <Pressable accessibilityRole="button" key={link.title} onPress={link.action} style={w.transaction}><View style={w.transactionIcon}><Icon name={link.icon} /></View><View style={{ flex: 1 }}><Text style={w.rowTitle}>{link.title}</Text><Text style={s.caption}>{link.note}</Text></View><Icon name="chevron-forward" size={18} color={colors.subtle} /></Pressable>)}</Panel><Text style={[s.caption, { textAlign: 'center', paddingVertical: 12 }]}>Teinco-X · A little clarity, every day.</Text></ScrollView>
}

const w = themedStyles(() => ({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brand: { color: colors.ink, fontSize: 20, fontWeight: '800', letterSpacing: -.6 }, date: { color: colors.muted, fontSize: 12, marginTop: 4 },
  headline: { color: colors.ink, fontSize: 32, lineHeight: 39, fontWeight: '700', letterSpacing: -1.1 }, eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  iconButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }, dot: { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.primary, fontWeight: '700' },
  hero: { backgroundColor: colors.hero, padding: 24, borderRadius: 28, gap: 16 }, heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, heroBadge: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,.10)' }, heroLabel: { fontSize: 14, fontWeight: '600', color: colors.heroMuted }, heroValue: { fontVariant: ['tabular-nums'], lineHeight: 43, fontSize: 34, fontWeight: '700', color: colors.heroText, letterSpacing: -1 }, heroNote: { color: colors.heroMuted, fontSize: 13, lineHeight: 20 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, metric: { flexBasis: 140, flexGrow: 1, padding: 18, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 6 }, metricValue: { fontVariant: ['tabular-nums'], fontSize: 24, lineHeight: 32, fontWeight: '700', color: colors.ink, letterSpacing: -.5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, padding: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 24 }, action: { minWidth: 72, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, gap: 10 }, actionIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.softBlue, alignItems: 'center', justifyContent: 'center' }, actionLabel: { color: colors.ink, fontWeight: '600', fontSize: 12, textAlign: 'center' },
  rowTitle: { color: colors.ink, fontSize: 16, lineHeight: 23, fontWeight: '600' }, amount: { color: colors.ink, fontSize: 17, fontWeight: '700', marginTop: 6 }, transaction: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }, transactionIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  moduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, moduleReveal: { flexBasis: 145, flexGrow: 1 }, moduleCard: { minHeight: 170, backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 18, shadowColor: colors.shadow, shadowOpacity: .07, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 2 }, themeCard: { flexBasis: 140, flexGrow: 1, backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 8 },
}))
