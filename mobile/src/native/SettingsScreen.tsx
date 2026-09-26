import { useMobileTheme } from '../theme'
import { useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native'
import { useNavigation, usePreventRemove } from '@react-navigation/native'
import { useAuth } from '../auth/AuthContext'
import { useRemote } from '../hooks/useRemote'
import { request } from '../api'
import { formPayload, initialValues, settingsFields, type Row } from './domain'
import { NativeField } from './Fields'
import { Button, Empty, LoadState, Section, s } from './Ui'
import { checkForAndroidUpdate, openAndroidUpdate, type AndroidUpdate } from '../updates'
export function SettingsScreen() {
  useMobileTheme()

  const { user, token, serverUrl } = useAuth(), remote = useRemote<Row>(user?.role === 'admin' ? '/settings' : null)
  const [values, setValues] = useState<Row | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [updateChecking, setUpdateChecking] = useState(false), [updateAvailable, setUpdateAvailable] = useState<AndroidUpdate | null>(null)
  const navigation = useNavigation(), [dirty, setDirty] = useState(false)
  usePreventRemove(dirty || busy, ({ data }) => {
    if (busy) { Alert.alert('Saving', 'Please wait for the save to finish.'); return }
    Alert.alert('Discard changes?', 'Your settings have not been saved.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) }])
  })
  useEffect(() => { if (remote.data) setValues(initialValues(settingsFields, remote.data)) }, [remote.data])
  if (user?.role !== 'admin') return <Empty title="Admin access required" />
  const save = async () => { if (busy || !values) return; setBusy(true); setError(''); try { const data = formPayload(settingsFields, values, 'admin'); await request(serverUrl, '/settings', token, { method: 'PUT', body: JSON.stringify(data) }); setDirty(false); Alert.alert('Settings saved', 'Your workspace preferences have been updated.') } catch (err) { setError(err instanceof Error ? err.message : 'Could not save settings.') } finally { setBusy(false) } }
  
  const checkUpdate = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert('Not available', 'Update checking is only available on Android.')
      return
    }
    setUpdateChecking(true)
    try {
      const update = await checkForAndroidUpdate()
      if (update) {
        setUpdateAvailable(update)
        Alert.alert(
          'Update Available',
          `Teinco-X ${update.version} is available.\n\n${update.notes || 'A newer version is ready to install.'}`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Update Now', onPress: () => void openAndroidUpdate(update.downloadUrl).catch(err => Alert.alert('Error', err instanceof Error ? err.message : 'Could not open download')) }
          ]
        )
      } else {
        Alert.alert('Up to Date', 'You are using the latest version of Teinco-X.')
      }
    } catch (err) {
      Alert.alert('Check Failed', err instanceof Error ? err.message : 'Could not check for updates.')
    } finally {
      setUpdateChecking(false)
    }
  }
  
  return <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={95}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}><Text style={s.title}>Workspace settings</Text><LoadState loading={remote.loading && !values} error={remote.error} retry={remote.refresh} />{values && settingsFields.map(field => <SettingsField key={field.key} field={field} values={values} busy={busy} update={value => { setValues(previous => ({ ...previous, [field.key]: value })); setDirty(true) }} />)}{!!error && <Text accessibilityRole="alert" style={s.errorText}>{error}</Text>}<Button label="Save settings" icon="checkmark" busy={busy} disabled={!values || !!remote.error} onPress={() => void save()} />{Platform.OS === 'android' && <Button secondary label="Check for updates" busy={updateChecking} onPress={() => void checkUpdate()} />}</ScrollView></KeyboardAvoidingView>
}
function SettingsField({ field, values, busy, update }: { field: typeof settingsFields[number]; values: Row; busy: boolean; update: (value: any) => void }) {
  useMobileTheme()
 return <>{field.section && <Section title={field.section} />}<NativeField field={field} value={values[field.key]} disabled={busy} onChange={update} /></> }
