import { useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAuth } from '../auth/AuthContext'
import { useRemote } from '../hooks/useRemote'
import { colors, currency, shortDate } from '../theme'
import { allowedModule, canWrite, dateKey, moduleById, recordAmount, recordDate, recordSubtitle, recordTitle, type Row } from './domain'
import { Button, Chips, Empty, Icon, LoadState, Panel, Search, Tag, s } from './Ui'
import { NativeField } from './Fields'
import type { RootStack } from './navigation'

export function RecordsScreen({ route, navigation }: NativeStackScreenProps<RootStack, 'Records'>) {
  const module = moduleById(route.params.module), { user } = useAuth(), role = user?.role || 'employee'
  const [search, setSearch] = useState(''), [debounced, setDebounced] = useState(''), [page, setPage] = useState(1), [period, setPeriod] = useState('all'), [workDate, setWorkDate] = useState(dateKey())
  const [showFilters, setShowFilters] = useState(false), [category, setCategory] = useState(''), [vendor, setVendor] = useState(''), [statusFilter, setStatusFilter] = useState('active')
  useEffect(() => { const timer = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(timer) }, [search])
  const params = new URLSearchParams(route.params.query || '')
  if (module.id === 'expenses') { params.set('page', String(page)); params.set('limit', '25'); if (debounced) params.set('search', debounced) }
  if (module.id === 'expenses' && category) params.set('categoryId', category)
  if (module.id === 'expenses' && vendor) params.set('vendorId', vendor)
  if (module.id === 'subscriptions') params.set('status', statusFilter)
  if (module.id === 'attendance') params.set('date', workDate)
  if (module.id === 'events' && !route.params.query) { params.set('startDate', dateKey()); params.set('endDate', dateKey(new Date(Date.now() + 90 * 86400000))) }
  if (['expenses', 'deposits'].includes(module.id) && period !== 'all') {
    const now = new Date(), start = new Date(now.getFullYear(), period === 'year' ? 0 : now.getMonth(), 1)
    params.set('startDate', start.toISOString()); params.set('endDate', now.toISOString())
  }
  const remote = useRemote<any>(allowedModule(module.id, role) ? `${module.endpoint}?${params}` : null)
  const records: Row[] = module.listKey ? remote.data?.[module.listKey] || [] : Array.isArray(remote.data) ? remote.data : []
  const filtered = module.id === 'expenses' ? records : records.filter(row => `${recordTitle(module.id, row)} ${recordSubtitle(module.id, row)} ${row.referenceNumber || ''} ${row.status || ''}`.toLowerCase().includes(search.toLowerCase()))
  if (!allowedModule(module.id, role)) return <Empty title="Admin access required" message="This module is restricted to administrators." />
  return <View style={s.page}>
    <FlatList data={filtered} keyExtractor={(row, index) => String(row.id ?? row.employeeId ?? row.insightId ?? index)} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { paddingBottom: 110 }]} refreshing={remote.loading} onRefresh={remote.refresh}
      ListHeaderComponent={<View style={{ gap: 14, marginBottom: 6 }}>
        <View><Text style={s.title}>{module.title}</Text><Text style={s.caption}>{module.id === 'expenses' ? `${remote.data?.total ?? '…'} matching transactions` : `${filtered.length} records`}{module.id === 'events' ? ' · next 90 days' : ''}</Text></View>
        {module.id === 'deposits' && remote.data && <View style={styles.summary}><Text style={styles.summaryLabel}>TOTAL RECEIVED · SELECTED PERIOD</Text><Text style={styles.summaryValue}>{currency(remote.data.totalReceived)}</Text></View>}
        <Search value={search} onChangeText={value => { setSearch(value); setPage(1) }} placeholder={`Search ${module.title.toLowerCase()}`} />
        {module.id === 'expenses' && <Button secondary icon="options-outline" label={showFilters ? 'Hide filters' : `Filters${category || vendor ? ' applied' : ''}`} onPress={() => setShowFilters(value => !value)} />}
        {module.id === 'expenses' && showFilters && <><NativeField field={{ key: 'category', label: 'Category', type: 'select', lookup: '/categories' }} value={category} onChange={value => { setCategory(value); setPage(1) }} /><NativeField field={{ key: 'vendor', label: 'Vendor', type: 'select', lookup: '/vendors' }} value={vendor} onChange={value => { setVendor(value); setPage(1) }} /></>}
        {module.id === 'subscriptions' && <Chips value={statusFilter} onChange={setStatusFilter} items={[{ id: 'active', label: 'Active' }, { id: 'cancelled', label: 'Cancelled' }, { id: 'all', label: 'All' }]} />}
        {['expenses', 'deposits'].includes(module.id) && !route.params.query && <Chips value={period} onChange={value => { setPeriod(value); setPage(1) }} items={[{ id: 'all', label: 'All time' }, { id: 'month', label: 'This month' }, { id: 'year', label: 'This year' }]} />}
        {route.params.query && <Text style={s.caption}>Showing the records linked from your workspace evidence.</Text>}
        {module.id === 'attendance' && <NativeField field={{ key: 'date', label: 'Attendance date', type: 'date' }} value={workDate} onChange={setWorkDate} />}
        {module.hint && <Text style={s.caption}>{module.hint}</Text>}
        {module.id === 'forecast' && remote.data?.baseline && <Panel><Text style={s.sectionTitle}>Recorded-spend baseline</Text><Text style={s.title}>{currency(remote.data.baseline.monthlyBurn)}</Text><Text style={s.caption}>Per month · {remote.data.baseline.historyCount} historical expenses</Text><Text style={s.caption}>{remote.data.baseline.method}</Text></Panel>}
        <LoadState loading={remote.loading && !remote.data} error={remote.error} retry={remote.refresh} />
      </View>}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListEmptyComponent={!remote.loading && !remote.error ? <Empty title={`No ${module.title.toLowerCase()} found`} message={search ? 'Try another search.' : module.create && canWrite(module, role) ? `Tap Add to create your first ${module.singular.toLowerCase()}.` : 'Pull down to refresh your records.'} icon={module.icon} /> : null}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Detail', { module: module.id, row: item })} style={({ pressed }) => [styles.row, pressed && { opacity: .65 }]}>
        <View style={styles.rowTop}><View style={styles.icon}><Icon name={module.icon} size={21} /></View><View style={{ flex: 1, gap: 4 }}><Text style={styles.rowTitle} numberOfLines={2}>{recordTitle(module.id, item)}</Text><Text style={styles.rowSubtitle} numberOfLines={2}>{recordSubtitle(module.id, item) || item.expenseId || item.depositId || item.slipId || item.employeeId || 'View details'}</Text></View><Icon name="chevron-forward" size={16} color={colors.subtle} /></View>
        <View style={styles.rowBottom}><Text style={styles.date}>{recordDate(item) ? shortDate(recordDate(item)) : item.code || ''}</Text>{recordAmount(item) !== null ? <Text style={styles.amount}>{currency(recordAmount(item)!, module.id === 'subscriptions' ? item.currency : 'INR')}</Text> : <Tag value={item.status || item.priority} />}</View>
      </Pressable>}
      ListFooterComponent={module.id === 'expenses' && remote.data?.totalPages > 1 ? <View style={styles.pagination}><Button secondary disabled={page <= 1 || remote.loading} label="Previous" onPress={() => setPage(value => value - 1)} /><Text style={s.caption}>{page} / {remote.data.totalPages}</Text><Button secondary disabled={page >= remote.data.totalPages || remote.loading} label="Next" onPress={() => setPage(value => value + 1)} /></View> : null}
    />
    {module.create && canWrite(module, role) && <Pressable accessibilityRole="button" accessibilityLabel={`Add ${module.singular.toLowerCase()}`} onPress={() => navigation.navigate('Edit', { module: module.id })} style={styles.fab}><Icon name="add" color="#fff" size={25} /><Text style={styles.fabText}>Add {module.singular.toLowerCase()}</Text></Pressable>}
  </View>
}
const styles = StyleSheet.create({ row: { backgroundColor: '#fff', borderRadius: 20, padding: 16, gap: 14, borderWidth: 1, borderColor: colors.border }, rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.softBlue, alignItems: 'center', justifyContent: 'center' }, rowTitle: { color: colors.ink, fontWeight: '700', fontSize: 15, lineHeight: 21 }, rowSubtitle: { color: colors.muted, fontSize: 12 }, rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 }, amount: { fontSize: 17, color: colors.ink, fontWeight: '800' }, date: { color: colors.muted, fontSize: 12, flexShrink: 1 }, summary: { backgroundColor: colors.primary, padding: 24, borderRadius: 24, gap: 10 }, summaryLabel: { color: '#BFD2EA', fontSize: 10, fontWeight: '700', letterSpacing: 1 }, summaryValue: { color: '#fff', fontSize: 31, fontWeight: '800' }, fab: { position: 'absolute', bottom: 20, right: 20, minHeight: 56, paddingHorizontal: 21, borderRadius: 28, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', gap: 9, elevation: 5 }, fabText: { color: '#fff', fontWeight: '700', fontSize: 14 }, pagination: { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 } })
