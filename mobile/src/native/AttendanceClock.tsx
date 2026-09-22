import { useRef, useState } from 'react'
import { Text } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import { request } from '../api'
import { useRemote } from '../hooks/useRemote'
import { Button, LoadState, Panel, s } from './Ui'
import type { Row } from './domain'

export function AttendanceClock() {
  const { user, token, serverUrl } = useAuth()
  const employee = user?.role === 'employee'
  const attendance = useRemote<Row[]>(employee ? '/employees/attendance' : null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = useRef(false)
  if (!employee) return null
  const log = attendance.data?.[0]
  const checkedIn = Boolean(log?.checkedIn), checkedOut = Boolean(log?.checkedOut)
  const clock = async () => {
    if (pending.current || checkedOut || attendance.loading || attendance.error) return
    pending.current = true; setBusy(true); setError('')
    try {
      await request(serverUrl, '/employees/attendance/clock', token, { method: 'POST', body: JSON.stringify({ action: checkedIn ? 'check_out' : 'check_in' }) })
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not record attendance.') }
    finally { await attendance.refresh(); pending.current = false; setBusy(false) }
  }
  return <Panel>
    <Text style={s.sectionTitle}>Attendance</Text>
    <Text style={s.caption}>Check in when you start work and check out when you finish.</Text>
    <LoadState loading={attendance.loading && !attendance.data} error={attendance.error} retry={attendance.refresh} />
    {!attendance.error && attendance.data && <Text style={s.caption}>{checkedOut ? 'Workday complete. You have checked out.' : checkedIn ? 'You are checked in.' : 'You have not checked in yet.'}</Text>}
    <Button label={checkedOut ? 'Checked out' : checkedIn ? 'Check-out' : 'Check-in'} icon={checkedIn ? 'log-out-outline' : 'log-in-outline'} busy={busy} disabled={checkedOut || attendance.loading || !!attendance.error || !attendance.data} onPress={() => void clock()} />
    {!!error && <Text accessibilityRole="alert" style={s.errorText}>{error}</Text>}
  </Panel>
}
