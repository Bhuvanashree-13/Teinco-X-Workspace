import { ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons, type IoniconsIconName } from '@react-native-vector-icons/ionicons'
import { useMobileTheme, colors, themedStyles } from '../theme'
export function Icon({ name, size = 22, color = colors.primary }: { name: string; size?: number; color?: string }) {
  useMobileTheme()
 return <Ionicons name={name as IoniconsIconName} size={size} color={color} style={{ width: size, height: size, lineHeight: size, textAlign: 'center', includeFontPadding: false }} /> }
export function Button({ label, onPress, icon, busy, disabled, secondary, danger }: { label: string; onPress: () => void; icon?: string; busy?: boolean; disabled?: boolean; secondary?: boolean; danger?: boolean }) {
  useMobileTheme()

  const color = danger ? colors.onDanger : secondary ? colors.primary : colors.onPrimary
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(busy || disabled), busy: Boolean(busy) }} disabled={busy || disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, danger && { backgroundColor: colors.danger }, (pressed || busy || disabled) && { opacity: .55 }]}>{busy ? <ActivityIndicator color={color} /> : <>{icon && <Icon name={icon} color={color} size={20} />}<Text style={[s.buttonText, { color }]}>{label}</Text></>}</Pressable>
}
export function Search({ value, onChangeText, placeholder = 'Search records' }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  useMobileTheme()
 return <View style={s.search}><Icon name="search-outline" color={colors.muted} size={20} /><TextInput selectionColor={colors.primary} accessibilityLabel={placeholder} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted} style={s.searchInput} autoCapitalize="none" />{!!value && <Pressable accessibilityLabel="Clear search" style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }} onPress={() => onChangeText('')}><Icon name="close-circle" color={colors.muted} size={20} /></Pressable>}</View> }
export function Chips({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  useMobileTheme()
 return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{items.map(item => <Pressable accessibilityRole="button" accessibilityState={{ selected: value === item.id }} key={item.id} onPress={() => onChange(item.id)} style={[s.chip, value === item.id && s.chipActive]}><Text style={[s.chipText, value === item.id && { color: colors.onPrimary }]}>{item.label}</Text></Pressable>)}</ScrollView> }
export function Tag({ value }: { value?: string }) {
  useMobileTheme()
 if (!value) return null
 const positive = ['active', 'approved', 'paid', 'present', 'done', 'complete', 'completed', 'resolved', 'received'].includes(value)
 const negative = ['blocked', 'rejected', 'overdue', 'absent', 'failed', 'highest'].includes(value)
 const pending = ['pending', 'review', 'high'].includes(value)
 const foreground = positive ? colors.success : negative ? colors.danger : pending ? colors.amber : colors.primary
 const background = positive ? colors.softGreen : negative ? colors.softDanger : pending ? colors.softAmber : colors.softBlue
 return <View style={[s.tag, { backgroundColor: background, flexDirection: 'row', alignItems: 'center', gap: 6 }]}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: foreground }} /><Text style={[s.tagText, { color: foreground }]}>{value.replace(/_/g, ' ')}</Text></View> }
export function Empty({ title = 'Nothing here yet', message = 'New records will appear here.', icon = 'file-tray-outline' }: { title?: string; message?: string; icon?: string }) {
  useMobileTheme()
 return <View style={s.empty}><View style={s.emptyIcon}><Icon name={icon} size={32} color={colors.muted} /></View><Text style={s.emptyTitle}>{title}</Text><Text style={s.emptyMessage}>{message}</Text></View> }
export function LoadState({ loading, error, retry }: { loading: boolean; error?: string | null; retry?: () => void }) {
  useMobileTheme()
 if (loading) return <View accessible accessibilityLabel="Loading your records" accessibilityState={{ busy: true }} style={[s.panel, { gap: 16 }]}>{[85, 65, 45].map(width => <View key={width} style={{ width: `${width}%`, height: 14, borderRadius: 7, backgroundColor: colors.border }} />)}<Text style={s.caption}>Loading your records…</Text></View>; if (!error) return null; return <View style={s.error}><Text accessibilityRole="alert" style={s.errorText}>{error}</Text>{retry && <Button secondary label="Try again" onPress={retry} />}</View> }
export function Section({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  useMobileTheme()
 return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{action && <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 48, minWidth: 48, justifyContent: 'center' }}><Text style={s.link}>{action}</Text></Pressable>}</View> }
export function Panel({ children }: { children: ReactNode }) {
  useMobileTheme()
 return <View style={s.panel}>{children}</View> }
export function RowValue({ label, value }: { label: string; value?: unknown }) {
  useMobileTheme()
 if (value === undefined || value === null || value === '') return null; return <View style={s.valueRow}><Text style={s.valueLabel}>{label}</Text><Text selectable style={s.valueText}>{String(value)}</Text></View> }
export const s = themedStyles(() => ({
  page: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 42, gap: 18 }, title: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: '700', letterSpacing: -.9 }, caption: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 4 },
  panel: { backgroundColor: colors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.border, gap: 11, shadowColor: colors.shadow, shadowOpacity: .035, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  button: { minHeight: 52, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, shadowColor: colors.shadow, shadowOpacity: .04, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 0 }, secondary: { backgroundColor: colors.softBlue, shadowOpacity: 0 }, buttonText: { flexShrink: 1, textAlign: 'center', fontSize: 15, fontWeight: '700' },
  search: { minHeight: 50, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 }, searchInput: { flex: 1, color: colors.ink, fontSize: 14, paddingVertical: 13 },
  chips: { gap: 8, paddingVertical: 3 }, chip: { minHeight: 48, justifyContent: 'center', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, chipActive: { backgroundColor: colors.primary, borderColor: colors.primary }, chipText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  tag: { borderRadius: 8, backgroundColor: colors.softAmber, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' }, tagText: { fontSize: 12, fontWeight: '700', color: colors.amber, textTransform: 'capitalize' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, paddingHorizontal: 26, gap: 12 }, emptyIcon: { height: 68, width: 68, borderRadius: 24, backgroundColor: colors.softBlue, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' }, emptyMessage: { color: colors.muted, textAlign: 'center', lineHeight: 20, fontSize: 14 },
  error: { padding: 18, borderRadius: 18, backgroundColor: colors.softDanger, gap: 12 }, errorText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 4 }, sectionTitle: { flexShrink: 1, fontWeight: '700', fontSize: 18, color: colors.ink, letterSpacing: -.3 }, link: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  valueRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 5 }, valueLabel: { fontSize: 12, fontWeight: '600', color: colors.muted }, valueText: { fontSize: 15, color: colors.ink, lineHeight: 22, fontWeight: '500' },
}))
