import { useState } from 'react'
import { FlatList, Image, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { launchImageLibrary } from 'react-native-image-picker'
import { useRemote } from '../hooks/useRemote'
import { colors, shortDate, themedStyles } from '../theme'
import { dateKey, human, type Field, type Row } from './domain'
import { Button, Empty, Icon, LoadState, Search, s } from './Ui'

export function NativeField({ field, value, onChange, disabled, existingLabel }: { field: Field; value: any; onChange: (value: any) => void; disabled?: boolean; existingLabel?: string }) {
  const [choosing, setChoosing] = useState(false), [query, setQuery] = useState(''), [iosMode, setIosMode] = useState<'date' | 'time' | null>(null)
  const remote = useRemote<Row[]>(field.lookup || null)
  const options = field.lookup ? (remote.data || []).map(row => ({ value: String(row.id), label: `${row.parent?.name ? `${row.parent.name} / ` : ''}${row.name}` })) : (field.choices || []).map(option => ({ value: option, label: human(option) }))
  const label = options.find(option => option.value === String(value))?.label || existingLabel || (value ? human(value) : `Choose ${field.label.toLowerCase()}`)
  const showDate = (mode: 'date' | 'time') => {
    if (Platform.OS !== 'android') { setIosMode(mode); return }
    const selected = value ? new Date(field.type === 'date' ? `${value}T12:00:00` : value) : new Date()
    DateTimePickerAndroid.open({ value: Number.isFinite(selected.getTime()) ? selected : new Date(), mode, is24Hour: false,
      onValueChange: (_event, date) => { onChange(field.type === 'date' ? dateKey(date) : date.toISOString()) },
    })
  }
  const chooseImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', includeBase64: true, selectionLimit: 1, maxWidth: 800, maxHeight: 800 })
    const asset = result.assets?.[0]
    if (!asset?.base64 || !asset.type || !['image/png', 'image/jpeg', 'image/webp'].includes(asset.type) || (asset.fileSize || 0) > 1_000_000) return
    onChange(`data:${asset.type};base64,${asset.base64}`)
  }
  if (field.type === 'boolean') return <View style={styles.toggle}><Text style={styles.label}>{field.label}</Text><Switch accessibilityLabel={field.label} value={Boolean(value)} disabled={disabled} onValueChange={onChange} trackColor={{ true: colors.accent }} /></View>
  if (field.type === 'image') return <View style={styles.field}><Text style={styles.label}>{field.label}</Text>{value ? <Image source={{ uri: String(value) }} style={{ width: 88, height: 88, borderRadius: 18 }} /> : null}<Button secondary disabled={disabled} label={value ? 'Change image' : 'Choose image'} onPress={() => void chooseImage()} />{value ? <Pressable onPress={() => onChange('')}><Text style={s.link}>Remove image</Text></Pressable> : null}<Text style={s.caption}>PNG, JPEG or WebP · maximum 1 MB</Text></View>
  return <View style={styles.field}>
    <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
    {field.type === 'select' ? <>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={() => { setQuery(''); setChoosing(true) }} style={styles.select}><Text style={[styles.inputText, !value && { color: colors.muted }]}>{label}</Text><Icon name="chevron-down" size={18} color={colors.muted} /></Pressable>
      {field.lookup && remote.error && <Text style={s.errorText}>Could not load choices. Tap the field to retry.</Text>}
      <Modal visible={choosing} animationType="slide" onRequestClose={() => setChoosing(false)} presentationStyle="pageSheet">
        <SafeAreaView style={s.page}><View style={[s.content, { paddingBottom: 10 }]}><View style={s.section}><Text style={s.sectionTitle}>{field.label}</Text><Button secondary label="Done" onPress={() => setChoosing(false)} /></View><Search value={query} onChangeText={setQuery} placeholder={`Find ${field.label.toLowerCase()}`} /></View>
          <FlatList keyboardShouldPersistTaps="handled" data={options.filter(option => option.label.toLowerCase().includes(query.toLowerCase()))} keyExtractor={item => item.value} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
            ListHeaderComponent={<><LoadState loading={remote.loading} error={remote.error} retry={remote.refresh} />{!field.required && <Button secondary label="None" onPress={() => { onChange(''); setChoosing(false) }} />}</>}
            ListEmptyComponent={!remote.loading && !remote.error ? <Empty title="No matching choices" message="Try another search or create a record first." /> : null}
            renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => { onChange(item.value); setChoosing(false) }} style={styles.option}><Text style={[styles.inputText, { flex: 1 }]}>{item.label}</Text>{item.value === String(value) && <Icon name="checkmark-circle" color={colors.success} />}</Pressable>} />
        </SafeAreaView>
      </Modal>
    </> : field.type === 'date' || field.type === 'datetime' ? <>
      <View style={{ flexDirection: 'row', gap: 8 }}><Pressable accessibilityRole="button" disabled={disabled} onPress={() => showDate('date')} style={[styles.select, { flex: 1 }]}><Text style={styles.inputText}>{value ? shortDate(field.type === 'date' ? `${value}T12:00:00` : value) : 'Choose date'}</Text><Icon name="calendar-outline" size={19} /></Pressable>
        {field.type === 'datetime' && <Pressable accessibilityRole="button" disabled={disabled} onPress={() => showDate('time')} style={styles.select}><Text style={styles.inputText}>{value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Time'}</Text></Pressable>}</View>
      {!field.required && !!value && <Pressable onPress={() => onChange('')}><Text style={s.link}>Clear date</Text></Pressable>}
      {iosMode && <DateTimePicker value={value ? new Date(field.type === 'date' ? `${value}T12:00:00` : value) : new Date()} mode={iosMode} onValueChange={(_event, date) => { setIosMode(null); onChange(field.type === 'date' ? dateKey(date) : date.toISOString()) }} onDismiss={() => setIosMode(null)} />}
    </> : <TextInput accessibilityLabel={field.label} value={String(value ?? '')} editable={!disabled} onChangeText={onChange} placeholder={field.type === 'number' ? '0.00' : field.label} placeholderTextColor={colors.subtle} keyboardType={field.type === 'number' ? 'decimal-pad' : field.type === 'email' ? 'email-address' : 'default'} autoCapitalize={field.type === 'email' ? 'none' : 'sentences'} multiline={field.type === 'multiline'} style={[styles.input, field.type === 'multiline' && { minHeight: 100, textAlignVertical: 'top' }]} />}
  </View>
}
const styles = themedStyles(() => ({ field: { gap: 8 }, label: { color: colors.ink, fontSize: 13, fontWeight: '700' }, input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 15, padding: 15, minHeight: 52, color: colors.ink, fontSize: 16 }, inputText: { color: colors.ink, fontSize: 14, flexShrink: 1 }, select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 15, minHeight: 52, backgroundColor: colors.surface }, toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }, option: { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } }))
