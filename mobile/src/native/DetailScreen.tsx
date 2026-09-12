import { useEffect, useState } from 'react'
import { Alert, Image, ScrollView, Share, Text, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useAuth } from '../auth/AuthContext'
import { request } from '../api'
import { useRemote } from '../hooks/useRemote'
import { colors, currency, shortDate } from '../theme'
import { allowedModule, canWrite, dateKey, human, moduleById, recordAmount, recordDate, recordTitle, type Row } from './domain'
import { Button, Empty, Icon, LoadState, Panel, RowValue, Tag, s } from './Ui'
import { NativeField } from './Fields'
import type { RootStack } from './navigation'
export function DetailScreen({ route, navigation }: NativeStackScreenProps<RootStack, 'Detail'>) {
  const module = moduleById(route.params.module), { user, token, serverUrl } = useAuth(), role = user?.role || 'employee'
  const readPath = module.detail ? `${module.endpoint}/${route.params.row.id}` : `${module.endpoint}${module.id === 'attendance' ? `?date=${dateKey(new Date(route.params.row.workDate))}` : module.id === 'events' ? `?startDate=${encodeURIComponent(route.params.row.startsAt)}&endDate=${encodeURIComponent(route.params.row.endsAt)}` : ''}`
  const remote = useRemote<any>(allowedModule(module.id, role) ? readPath : null)
  const [row, setRow] = useState(route.params.row), [busy, setBusy] = useState(false), [error, setError] = useState(''), [reference, setReference] = useState(route.params.row.paymentUtr || '')
  useEffect(() => {
    if (!remote.data) return
    const entries = module.listKey ? remote.data[module.listKey] : remote.data
    const incoming = module.detail ? remote.data : Array.isArray(entries) ? entries.find((item: Row) => route.params.row.id !== undefined ? item.id === route.params.row.id : route.params.row.insightId ? item.insightId === route.params.row.insightId : item.employeeId === route.params.row.employeeId) : null
    if (incoming) { setRow(incoming); setReference(incoming.paymentUtr || '') }
  }, [remote.data, module.detail, module.listKey, route.params.row])
  if (!allowedModule(module.id, role)) return <Empty title="Access restricted" message="This record is not available to your role." />
  const mutate = async (path: string, data: Row, method = 'PUT') => {
    if (busy) return
    setBusy(true); setError('')
    try { const result = await request<Row>(serverUrl, path, token, { method, body: method === 'DELETE' ? undefined : JSON.stringify(data) }); if (method === 'DELETE') navigation.goBack(); else { setRow(previous => ({ ...previous, ...result })); Alert.alert('Saved', 'Your changes have been saved.') } }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save.') }
    finally { setBusy(false) }
  }
  const status = (value: string) => {
    const endpoint = `${module.endpoint}/${row.id}${module.id === 'taskboard' ? '' : '/status'}`
    const data = module.id === 'leave' ? { status: value, approverName: user?.name || user?.email, blackoutChecked: Boolean(row.blackoutChecked) } : { status: value }
    Alert.alert(`${human(value)}?`, 'This updates the shared workspace record.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => void mutate(endpoint, data) }])
  }
  const amount = recordAmount(row)
  return <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
    <View style={{ alignItems: 'center', paddingVertical: 15, gap: 10 }}><View style={{ backgroundColor: colors.softBlue, padding: 20, borderRadius: 24 }}><Icon name={module.icon} size={32} /></View><Text style={[s.title, { textAlign: 'center', fontSize: 23 }]}>{recordTitle(module.id, row)}</Text>{amount !== null && <Text style={[s.title, { fontSize: 34 }]}>{currency(amount, module.id === 'subscriptions' ? row.currency : 'INR')}</Text>}<Tag value={row.status || row.priority} /><Text style={s.caption}>{recordDate(row) ? shortDate(recordDate(row)) : ''}</Text></View>
    <LoadState loading={remote.loading} error={remote.error || error} retry={remote.error ? remote.refresh : undefined} />
    {module.edit && canWrite(module, role) && !row.payrollBatchId && !remote.loading && !remote.error && <Button icon="create-outline" label={`Edit ${module.singular.toLowerCase()}`} onPress={() => navigation.navigate('Edit', { module: module.id, row })} />}
    {row.payrollBatchId && <Text style={s.caption}>This salary expense is linked to payroll and cannot be edited as a regular expense.</Text>}
    {['expenses', 'deposits'].includes(module.id) && <Button secondary icon="share-outline" label="Share transaction summary" onPress={() => void Share.share({ message: `${recordTitle(module.id, row)}\n${row.expenseId || row.depositId}\n${shortDate(recordDate(row))}\n${currency(recordAmount(row) || 0)}\n${row.invoiceNumber ? `Invoice: ${row.invoiceNumber}` : row.referenceNumber ? `Reference: ${row.referenceNumber}` : ''}` }).catch(() => setError('Could not open sharing.'))} />}
    <Panel>
      {module.fields.filter(field => !field.admin || role === 'admin').map(field => {
        let value = row[field.key]
        if (field.type === 'image') return value ? <Image key={field.key} source={{ uri: String(value) }} accessibilityLabel={field.label} style={{ width: 96, height: 96, borderRadius: 20, marginBottom: 12 }} /> : <RowValue key={field.key} label={field.label} value="No image" />
        if (field.lookup) value = row[field.key.replace(/Id$/, '')]?.name || (value ? 'Linked record' : null)
        if (field.type === 'boolean' && value !== undefined) value = value ? 'Yes' : 'No'
        if (field.type === 'date' && value) value = shortDate(value)
        if (field.type === 'datetime' && value) value = new Date(value).toLocaleString()
        return <RowValue key={field.key} label={field.label} value={value} />
      })}
      <RowValue label="Record reference" value={row.expenseId || row.depositId || row.code || row.requestId || row.slipId || row.batchId || row.ruleId || row.insightId || row.milestoneId || row.eventId || row.employeeId} />
      {module.id === 'expenses' && <><RowValue label="GST amount" value={currency(Number(row.gstAmount), row.originalCurrency)} /><RowValue label="Total in INR" value={currency(Number(row.baseCurrencyAmount))} /></>}
      {module.id === 'balances' && <><RowValue label="Annual allowance" value={`${row.allowance} days`} /><RowValue label="Used" value={`${row.used} days`} /><RowValue label="Available" value={`${row.balance} days`} /></>}
      {module.id === 'vendors' && <><RowValue label="This year spending" value={currency(row.currentYearSpend)} /><RowValue label="Last year spending" value={currency(row.previousYearSpend)} /></>}
      {module.id === 'payroll' && <><RowValue label="Employee count" value={row.employeeCount} /><RowValue label="Gross pay" value={currency(row.grossPay)} /><RowValue label="Approved reimbursements" value={currency(row.approvedExpenses)} /></>}
      {module.id === 'payslips' && <><RowValue label="Period" value={`${shortDate(row.periodStart)} – ${shortDate(row.periodEnd)}`} />{(row.earnings || []).map((item: Row) => <RowValue key={item.label} label={item.label} value={currency(item.amount)} />)}{(row.deductions || []).map((item: Row) => <RowValue key={item.label} label={item.label} value={currency(item.amount)} />)}<RowValue label="Net pay" value={currency(row.netPay)} /></>}
    </Panel>
    {module.id === 'payslips' && <><Panel><NativeField field={{ key: 'paymentReference', label: 'UTR / payment reference' }} value={reference} disabled={busy} onChange={setReference} /><Button label="Save reference" busy={busy} disabled={reference.length > 60} onPress={() => void mutate(`/employees/payslips/${row.id}/payment-reference`, { paymentReference: reference.trim() })} /><Text style={s.caption}>Maximum 60 characters.</Text></Panel><Button secondary icon="share-outline" label="Share payslip summary" onPress={() => void Share.share({ message: `${row.slipId}\n${row.employee?.name}\n${shortDate(row.periodStart)} – ${shortDate(row.periodEnd)}\nEarnings: ${currency(row.totalEarnings)}\nDeductions: ${currency(row.totalDeductions)}\nNet pay: ${currency(row.netPay)}\nPayment reference: ${row.paymentUtr || 'Not entered'}` }).catch(() => setError('Could not open sharing.'))} /></>}
    {module.id === 'leave' && role === 'admin' && row.status === 'pending' && <><Button label="Approve leave" busy={busy} onPress={() => status('approved')} /><Button secondary label="Reject leave" disabled={busy} onPress={() => status('rejected')} /></>}
    {module.id === 'milestones' && row.status !== 'complete' && <Button label="Mark complete" busy={busy} onPress={() => status('complete')} />}
    {module.id === 'taskboard' && role === 'admin' && <Panel>{['open', 'in_progress', 'blocked', 'complete'].filter(value => value !== row.status).map(value => <Button key={value} secondary label={`Move to ${human(value)}`} busy={busy} onPress={() => status(value)} />)}</Panel>}
    {module.id === 'automation' && <Button busy={busy} label={row.status === 'active' ? 'Pause rule' : 'Activate rule'} onPress={() => status(row.status === 'active' ? 'paused' : 'active')} />}
    {module.id === 'insights' && row.id && row.status !== 'resolved' && <Button label="Resolve insight" busy={busy} onPress={() => status('resolved')} />}
    {module.deleteLabel && role === 'admin' && !row.payrollBatchId && <Button secondary disabled={busy} label={module.deleteLabel} onPress={() => Alert.alert(`${module.deleteLabel}?`, 'This changes the record in your shared workspace.', [{ text: 'Keep record', style: 'cancel' }, { text: module.deleteLabel, style: 'destructive', onPress: () => void mutate(`${module.endpoint}/${row.id}`, {}, 'DELETE') }])} />}
  </ScrollView>
}
