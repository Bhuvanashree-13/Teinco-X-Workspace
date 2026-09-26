import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import { useRemote } from '../hooks/useRemote'
import { useMobileTheme, colors, currency } from '../theme'
import { Chips, Empty, LoadState, Panel, Section, s } from './Ui'
import type { Row } from './domain'
export function AnalyticsScreen() {
  useMobileTheme()

  const { user } = useAuth(), now = new Date().getFullYear(), [year, setYear] = useState(String(now)), [group, setGroup] = useState('analyst'), [selected, setSelected] = useState<Row | null>(null)
  const remote = useRemote<Row[]>(user?.role === 'admin' && group !== 'analyst' ? `/analytics/${group === 'project' ? 'project-allocation' : `spend-by-${group}`}?year=${year}` : null)
  const advisory = useRemote<Row>(user?.role === 'admin' && group === 'analyst' ? `/analytics/advisory?year=${year}` : null)
  const selectedKey = selected ? group === 'category' ? String(selected.categoryId) : group === 'project' ? (selected.projectId == null ? 'unassigned' : String(selected.projectId)) : String(selected.key) : ''
  const detail = useRemote<Row[]>(selected ? `/analytics/spending-details?year=${year}&group=${group}&key=${encodeURIComponent(selectedKey)}` : null)
  if (user?.role !== 'admin') return <Empty title="Admin access required" />
  const rows = [...(remote.data || [])].sort((a, b) => b.amount - a.amount), total = rows.reduce((sum, row) => sum + Number(row.amount), 0), max = Math.max(1, ...rows.map(row => Number(row.amount)))
  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surface} refreshing={remote.loading || advisory.loading} onRefresh={() => void (group === 'analyst' ? advisory.refresh() : remote.refresh())} />}>
    <Text style={s.title}>Analyst intelligence</Text><Text style={s.caption}>Evidence, implications, and recommended actions.</Text>
    <Chips value={year} onChange={value => { setYear(value); setSelected(null) }} items={[now, now - 1, now - 2, now - 3].map(value => ({ id: String(value), label: String(value) }))} />
    <Chips value={group} onChange={value => { setGroup(value); setSelected(null) }} items={[{ id: 'analyst', label: 'Analyst' }, { id: 'category', label: 'Categories' }, { id: 'vendor', label: 'Vendors' }, { id: 'project', label: 'Projects' }]} />
    {group === 'analyst' && <><LoadState loading={advisory.loading && !advisory.data} error={advisory.error} retry={advisory.refresh} />{advisory.data && <><View style={{ padding: 25, gap: 10, borderRadius: 26, backgroundColor: colors.hero }}><Text style={{ color: colors.heroText, fontSize: 11, fontWeight: '700' }}>RECORDED SPENDING · {year}</Text><Text style={{ color: colors.heroText, fontSize: 32, fontWeight: '700' }}>{currency(advisory.data.metrics.spend)}</Text><Text style={{ color: colors.heroText }}>{advisory.data.metrics.blocked} blocked · {advisory.data.metrics.overdue} overdue</Text></View><Section title="Analyst findings" />{advisory.data.findings.map((finding: Row) => <Panel key={finding.title}><View style={{ gap: 9 }}><Text style={s.sectionTitle}>{finding.title}</Text><Text style={s.valueText}>{finding.observation}</Text><Text style={s.caption}>{finding.implication}</Text><View style={{ borderRadius: 14, backgroundColor: colors.softBlue, padding: 12 }}><Text style={[s.valueText, { color: colors.primary }]}>Recommended: {finding.recommendation}</Text></View><Text style={s.caption}>{finding.confidence} confidence · {finding.method}</Text></View></Panel>)}<Section title="Project portfolio" />{advisory.data.portfolio.length ? <Panel>{advisory.data.portfolio.map((row: Row) => <View key={row.id} style={{ paddingVertical: 10, gap: 5 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={s.valueText}>{row.name}</Text><Text style={[s.valueText, { color: row.quadrant === 'Intervene' ? colors.danger : colors.success }]}>{row.quadrant}</Text></View><Text style={s.caption}>{row.deliveryScore}% delivered · {row.budgetUsed == null ? 'No budget' : `${row.budgetUsed}% budget used`} · {row.blocked} blocked</Text></View>)}</Panel> : <Empty title="No project portfolio yet" message="Add projects and work items to build this analysis." />}</>}</>}
    <LoadState loading={remote.loading && !remote.data} error={remote.error} retry={remote.refresh} />
    {remote.data && <><View style={{ padding: 25, gap: 10, borderRadius: 26, backgroundColor: colors.hero }}><Text style={{ color: colors.heroText, fontSize: 11, fontWeight: '700' }}>RECORDED SPENDING · {year}{Number(year) === now ? ' TO DATE' : ''}</Text><Text style={{ color: colors.heroText, fontSize: 32, fontWeight: '700' }}>{currency(total)}</Text></View>
      <Section title="Spending breakdown" />{rows.length ? <Panel>{rows.map((row, index) => {
        const key = String(row.key ?? row.categoryId ?? row.projectId ?? index)
        const open = selectedKey === (group === 'project' && row.projectId == null ? 'unassigned' : group === 'category' ? String(row.categoryId) : String(row.key))
        const label = row.category || row.vendor || row.project
        return <View key={key} style={{ paddingVertical: 10, gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${open ? 'Hide' : 'View'} ${label} breakdown`} onPress={() => setSelected(open ? null : row)} style={({ pressed }) => ({ gap: 10, opacity: pressed ? .65 : 1 })}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={[s.valueText, { flex: 1 }]} numberOfLines={2}>{label}</Text><Text style={[s.valueText, { fontWeight: '700' }]}>{currency(row.amount)} {open ? '⌃' : '›'}</Text></View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.softBlue, overflow: 'hidden' }}><View style={{ height: 8, borderRadius: 4, backgroundColor: row.color || colors.accent, width: `${Math.min(100, Math.max(0, Number(row.amount) / max * 100))}%` }} /></View>
            <Text style={s.caption}>{total > 0 ? `${(Number(row.amount) / total * 100).toFixed(1)}% of recorded spending` : 'No positive spending total'}{row.kind && row.kind !== 'vendor' ? ' · excluded from vendor rankings' : ''}</Text>
          </Pressable>
          {open && <View style={{ gap: 8, borderRadius: 16, padding: 14, backgroundColor: colors.softBlue }}>
            <LoadState loading={detail.loading} error={detail.error} retry={detail.refresh} />
            {!detail.loading && !detail.error && detail.data?.length === 0 && <Text style={s.caption}>No matching transactions were found.</Text>}
            {detail.data?.map(item => <View key={item.id} style={{ paddingVertical: 8, gap: 5, borderBottomWidth: 1, borderBottomColor: colors.border }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={[s.valueText, { flex: 1 }]} numberOfLines={2}>{item.description}</Text><Text style={[s.valueText, { fontWeight: '700' }]}>{currency(item.amount)}</Text></View><Text style={s.caption}>{item.expenseId} · {new Date(item.expenseDate).toLocaleDateString()} · {item.vendor || item.project || item.category || 'Unassigned'}</Text><Text style={s.caption}>Before GST {currency(item.baseAmount)} · GST {currency(item.gstAmount)}</Text></View>)}
          </View>}
        </View>
      })}</Panel> : <Empty title="No spending in this period" message="Choose another year or add your first expense." />}
    </>}
  </ScrollView>
}
