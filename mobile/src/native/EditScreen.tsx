import { useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { usePreventRemove } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAuth } from '../auth/AuthContext'
import { request } from '../api'
import { currency } from '../theme'
import { allowedModule, canWrite, formPayload, initialValues, moduleById, type Row } from './domain'
import { Button, Empty, Panel, s } from './Ui'
import { NativeField } from './Fields'
import type { RootStack } from './navigation'

export function EditScreen({ route, navigation }: NativeStackScreenProps<RootStack, 'Edit'>) {
  const module = moduleById(route.params.module), original = route.params.row
  const { user, token, serverUrl } = useAuth(), role = user?.role || 'employee'
  const [values, setValues] = useState<Row>(() => initialValues(module.fields, original))
  const [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const submitted = useRef(false), saved = useRef(false)
  usePreventRemove(dirty || busy, ({ data }) => {
    if (saved.current) { navigation.dispatch(data.action); return }
    if (busy) { Alert.alert('Saving', 'Please wait for the save to finish.'); return }
    Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) }])
  })
  if (!allowedModule(module.id, role) || !canWrite(module, role) || (original ? !module.edit : !module.create) || original?.payrollBatchId) return <Empty title="This action is unavailable" message="Your role or this record does not permit editing here." />
  const performSave = async (data: Row) => {
    if (submitted.current) return
    submitted.current = true; setBusy(true); setError('')
    try {
      await request(serverUrl, original ? `${module.endpoint}/${original.id}` : module.post || module.endpoint, token, { method: original ? 'PUT' : 'POST', body: JSON.stringify(data) })
      saved.current = true; setDirty(false); navigation.goBack()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save.'); submitted.current = false }
    finally { setBusy(false) }
  }
  const save = () => {
    try {
      const data = formPayload(module.fields.filter(field => !original || !field.createOnly), values, role)
      if (module.id === 'attendance' || module.id === 'leave') {
        if (role !== 'admin' && !user?.employeeId) throw new Error('Your account needs a linked employee profile.')
      }
      if (module.id === 'expenses' && !original) {
        data.isRecurring = data.expenseType === 'recurring'; data.isCapitalExpense = data.expenseType === 'capex'
        if (data.isRecurring && !data.nextDueDate) throw new Error('Choose the first due date for this recurring expense.')
        if (!data.isRecurring) { delete data.frequency; delete data.nextDueDate }
      }
      if (module.id === 'subscriptions' && !original && !data.nextBillingDate) delete data.nextBillingDate
      if (module.id === 'events' || module.id === 'milestones') data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
      if (module.id === 'payroll') Alert.alert('Create payroll batch?', module.hint, [{ text: 'Cancel', style: 'cancel' }, { text: 'Create batch', onPress: () => void performSave(data) }])
      else void performSave(data)
    } catch (err) { setError(err instanceof Error ? err.message : 'Check the form.') }
  }
  const total = (Number(values.baseAmount) || 0) * (1 + (Number(values.gstRate) || 0) / 100)
  return <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text style={s.caption}>{original ? 'Update the details below.' : `Add a ${module.singular.toLowerCase()} to your workspace.`}</Text>
      {module.hint && <Text style={s.caption}>{module.hint}</Text>}
      {(module.id === 'expenses' || module.id === 'deposits') && <Panel><Text style={s.caption}>{module.id === 'expenses' ? 'Total including GST' : 'Amount received'}</Text><Text style={s.title}>{currency(module.id === 'expenses' ? total : Number(values.originalAmount), values.originalCurrency)}</Text>{values.originalCurrency !== 'INR' && <Text style={s.caption}>INR value: {currency((module.id === 'expenses' ? total : Number(values.originalAmount)) * Number(values.exchangeRate))}</Text>}</Panel>}
      {module.fields.filter(field => (!field.admin || role === 'admin') && (!original || !field.createOnly) && (!['frequency', 'nextDueDate'].includes(field.key) || values.expenseType === 'recurring') && (field.key !== 'exchangeRate' || values.originalCurrency !== 'INR')).map(field => <NativeField key={field.key} field={field} value={values[field.key]} disabled={busy} existingLabel={original?.[field.key.replace(/Id$/, '')]?.name} onChange={value => { setValues(prev => ({ ...prev, [field.key]: value, ...(field.key === 'originalCurrency' ? { exchangeRate: value === 'INR' ? '1' : '' } : {}) })); setDirty(true); setError('') }} />)}
      {!!error && <Text accessibilityRole="alert" style={s.errorText}>{error}</Text>}
      <Button label={original ? 'Save changes' : `Save ${module.singular.toLowerCase()}`} busy={busy} icon="checkmark" onPress={save} />
    </ScrollView>
  </KeyboardAvoidingView>
}
