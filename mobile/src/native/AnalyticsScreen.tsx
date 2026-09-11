import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import { useRemote } from '../hooks/useRemote'
import { colors, currency } from '../theme'
import { Chips, Empty, LoadState, Panel, Section, s } from './Ui'
import type { Row } from './domain'
export function AnalyticsScreen() {
  const { user } = useAuth(), now = new Date().getFullYear(), [year, setYear] = useState(String(now)), [group, setGroup] = useState('category'), [selected, setSelected] = useState<Row | null>(null)
  const remote = useRemote<Row[]>(user?.role === 'admin' ? `/analytics/${group === 'project' ? 'project-allocation' : `spend-by-${group}`}?year=${year}` : null)
  const selectedKey = selected ? group === 'category' ? String(selected.categoryId) : group === 'project' ? (selected.projectId == null ? 'unassigned' : String(selected.projectId)) : String(selected.key) : ''
  const detail = useRemote<Row[]>(selected ? `/analytics/spending-details?year=${year}&group=${group}&key=${encodeURIComponent(selectedKey)}` : null)
  if (user?.role !== 'admin') return <Empty title="Admin access required" />
  const rows = [...(remote.data || [])].sort((a, b) => b.amount - a.amount), total = rows.reduce((sum, row) => sum + Number(row.amount), 0), max = Math.max(1, ...rows.map(row => Number(row.amount)))
  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={remote.loading} onRefresh={remote.refresh} />}>
    <Text style={s.title}>Spending insights</Text><Text style={s.caption}>Understand where your money goes.</Text>
    <Chips value={year} onChange={value => { setYear(value); setSelected(null) }} items={[now, now - 1, now - 2, now - 3].map(value => ({ id: String(value), label: String(value) }))} />
    <Chips value={group} onChange={value => { setGroup(value); setSelected(null) }} items={[{ id: 'category', label: 'Categories' }, { id: 'vendor', label: 'Vendors' }, { id: 'project', label: 'Projects' }]} />
    <LoadState loading={remote.loading && !remote.data} error={remote.error} retry={remote.refresh} />
    {remote.data && <><View style={{ padding: 25, gap: 10, borderRadius: 26, backgroundColor: colors.primary }}><Text style={{ color: '#BCD0E8', fontSize: 11, fontWeight: '700' }}>RECORDED SPENDING · {year}{Number(year) === now ? ' TO DATE' : ''}</Text><Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>{currency(total)}</Text></View>
      <Section title="Spending breakdown" />{rows.length ? <Panel>{rows.map((row, index) => <Pressable accessibilityRole="button" accessibilityLabel={`View ${row.category || row.vendor || row.project} breakdown`} onPress={() => setSelected(row)} key={row.key || row.categoryId || row.projectId || index} style={{ gap: 10, paddingVertical: 10 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={[s.valueText, { flex: 1 }]}>{row.category || row.vendor || row.project}</Text><Text style={[s.valueText, { fontWeight: '700' }]}>{currency(row.amount)} ›</Text></View><View style={{ height: 8, borderRadius: 4, backgroundColor: colors.softBlue, overflow: 'hidden' }}><View style={{ height: 8, borderRadius: 4, backgroundColor: row.color || colors.accent, width: `${Math.min(100, Math.max(0, Number(row.amount) / max * 100))}%` }} /></View><Text style={s.caption}>{total > 0 ? `${(Number(row.amount) / total * 100).toFixed(1)}% of recorded spending` : 'No positive spending total'}{row.kind && row.kind !== 'vendor' ? ' · excluded from vendor rankings' : ''}</Text></Pressable>)}</Panel> : <Empty title="No spending in this period" message="Choose another year or add your first expense." />}
      {selected && <><Section title={`${selected.category || selected.vendor || selected.project} details`} action="Close" onPress={() => setSelected(null)} /><LoadState loading={detail.loading} error={detail.error} retry={detail.refresh} />{detail.data && <Panel>{detail.data.map(item => <View key={item.id} style={{ paddingVertical: 10, gap: 5 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={[s.valueText, { flex: 1 }]}>{item.description}</Text><Text style={[s.valueText, { fontWeight: '700' }]}>{currency(item.amount)}</Text></View><Text style={s.caption}>{item.expenseId} · {new Date(item.expenseDate).toLocaleDateString()} · {item.vendor || item.project || item.category || 'Unassigned'}</Text><Text style={s.caption}>Before GST {currency(item.baseAmount)} · GST {currency(item.gstAmount)}</Text></View>)}</Panel>}</>}
    </>}
  </ScrollView>
}
