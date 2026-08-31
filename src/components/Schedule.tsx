import { useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Flag,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { apiPost, apiPut, useApi } from '../hooks/useApi'

type Employee = {
  id: number
  employeeId: string
  name: string
  department?: string | null
}

type Project = {
  id: number
  code: string
  name: string
  color?: string | null
}

type ScheduleSummary = {
  timezone: string
  upcomingEvents: number
  openMilestones: number
  conflicts: number
  priorityCounts: Record<string, number>
}

type ScheduleEvent = {
  id: number
  eventId: string
  title: string
  eventType: string
  priority: string
  module: string
  startsAt: string
  endsAt: string
  timezone: string
  location?: string | null
  ownerName?: string | null
  employee?: Employee | null
  project?: Project | null
}

type Milestone = {
  id: number
  milestoneId: string
  title: string
  milestoneType: string
  priority: string
  dueAt: string
  timezone: string
  ownerDepartment?: string | null
  project?: Project | null
  status: string
}

type Conflict = {
  type: string
  priority: string
  employeeName: string
  startsAt: string
  timezone: string
  title: string
  recommendation: string
}

const timezone = 'Asia/Kolkata'
const priorityOrder = ['urgent', 'standard', 'informational']
const today = new Date().toISOString().slice(0, 10)
const rangeEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

const toLocalInput = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

const now = new Date()
now.setMinutes(0, 0, 0)
const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

const eventDefaults = {
  title: '',
  eventType: 'meeting',
  priority: 'standard',
  module: 'schedule',
  startsAt: toLocalInput(now),
  endsAt: toLocalInput(oneHourLater),
  location: '',
  ownerName: '',
  employeeId: '',
  projectId: '',
  description: '',
}

const milestoneDefaults = {
  title: '',
  milestoneType: 'project',
  priority: 'standard',
  module: 'schedule',
  dueAt: toLocalInput(oneHourLater),
  ownerDepartment: '',
  projectId: '',
  notes: '',
}

const tabs = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'milestones', label: 'Milestones', icon: Flag },
  { id: 'conflicts', label: 'Conflicts', icon: ShieldAlert },
]

const toneByPriority: Record<string, string> = {
  urgent: 'border-red-200 bg-red-50 text-red-700',
  standard: 'border-slate-200 bg-slate-50 text-slate-700',
  informational: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const toneByStatus: Record<string, string> = {
  scheduled: 'border-slate-200 bg-slate-50 text-slate-700',
  complete: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-red-200 bg-red-50 text-red-700',
  open: 'border-slate-200 bg-slate-50 text-slate-700',
}

const labelize = (value?: string | null) => (value || 'unassigned').replace(/_/g, ' ')

const formatDateTime = (value: string, eventTimezone = timezone) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: eventTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value))
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute} ${eventTimezone}`
}

function Pill({ value, tone = 'status' }: { value: string; tone?: 'status' | 'priority' }) {
  const className = tone === 'priority' ? toneByPriority[value] : toneByStatus[value]
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium capitalize ${className || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
      {labelize(value)}
    </span>
  )
}

function Metric({ icon: Icon, label, value, caption }: { icon: any; label: string; value: string; caption: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#64748B]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[#1E3A8A] dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{caption}</p>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-[#1E3A8A] dark:bg-gray-700 dark:text-white">
          <Icon className="h-4 w-4" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

function groupByPriority<T extends { priority: string }>(items: T[]) {
  return priorityOrder.map(priority => ({
    priority,
    items: items.filter(item => item.priority === priority),
  }))
}

export default function Schedule() {
  const [activeTab, setActiveTab] = useState('calendar')
  const [search, setSearch] = useState('')
  const [eventForm, setEventForm] = useState(eventDefaults)
  const [milestoneForm, setMilestoneForm] = useState(milestoneDefaults)
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')

  const { data: summary, refetch: refetchSummary } = useApi<ScheduleSummary>('/schedule/summary')
  const { data: events, refetch: refetchEvents } = useApi<ScheduleEvent[]>(`/schedule/events?startDate=${today}&endDate=${rangeEnd}`)
  const { data: milestones, refetch: refetchMilestones } = useApi<Milestone[]>('/schedule/milestones')
  const { data: conflicts, refetch: refetchConflicts } = useApi<Conflict[]>('/schedule/conflicts')
  const { data: employees } = useApi<Employee[]>('/employees?status=all')
  const { data: projects } = useApi<Project[]>('/projects')

  const employeeList = employees || []
  const projectList = projects || []
  const eventList = events || []
  const milestoneList = milestones || []
  const conflictList = conflicts || []

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return eventList
    return eventList.filter(event =>
      [event.title, event.eventId, event.employee?.name, event.project?.name, event.ownerName, event.location]
        .some(value => value?.toLowerCase().includes(term))
    )
  }, [eventList, search])

  const refreshSchedule = async () => {
    await Promise.all([refetchSummary(), refetchEvents(), refetchMilestones(), refetchConflicts()])
  }

  const submitEvent = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('event')
    setMessage('')
    try {
      await apiPost('/schedule/events', { ...eventForm, timezone })
      setEventForm(eventDefaults)
      setMessage('Calendar event scheduled.')
      await refreshSchedule()
    } catch (error: any) {
      setMessage(error.message || 'Could not schedule event.')
    } finally {
      setSaving('')
    }
  }

  const submitMilestone = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('milestone')
    setMessage('')
    try {
      await apiPost('/schedule/milestones', { ...milestoneForm, timezone })
      setMilestoneForm(milestoneDefaults)
      setMessage('Milestone added to the company timeline.')
      await refreshSchedule()
    } catch (error: any) {
      setMessage(error.message || 'Could not create milestone.')
    } finally {
      setSaving('')
    }
  }

  const completeMilestone = async (id: number) => {
    setSaving(`milestone-${id}`)
    setMessage('')
    try {
      await apiPut(`/schedule/milestones/${id}/status`, { status: 'complete' })
      setMessage('Milestone marked complete.')
      await refreshSchedule()
    } catch (error: any) {
      setMessage(error.message || 'Could not update milestone.')
    } finally {
      setSaving('')
    }
  }

  const employeeOptions = (
    <>
      <option value="">No assigned employee</option>
      {employeeList.map(employee => <option key={employee.id} value={employee.id}>{employee.name} - {employee.employeeId}</option>)}
    </>
  )

  const projectOptions = (
    <>
      <option value="">No linked project</option>
      {projectList.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
    </>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Teinco-X Schedule</p>
          <h2 className="mt-1 text-[32px] font-semibold leading-tight text-[#1E3A8A] dark:text-white">Schedule Operations</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Cross-company calendar, project milestones, and conflict resolution in {summary?.timezone || timezone}.
          </p>
        </div>
        <button
          onClick={refreshSchedule}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#1E3A8A] shadow-sm hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={CalendarDays} label="Upcoming events" value={String(summary?.upcomingEvents || 0)} caption="Next 14 days" />
        <Metric icon={Flag} label="Open milestones" value={String(summary?.openMilestones || 0)} caption="Project, audit, tax, launch" />
        <Metric icon={AlertTriangle} label="Conflicts" value={String(summary?.conflicts || 0)} caption="Double-bookings detected" />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-[#1E3A8A] text-[#1E3A8A] dark:border-white dark:text-white'
                : 'border-transparent text-slate-500 hover:text-[#1E3A8A] dark:hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" strokeWidth={1.5} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'calendar' && (
        <section className="grid gap-4 xl:grid-cols-[1fr_390px]">
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search events, owners, projects..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {groupByPriority(filteredEvents).map(group => (
              <div key={group.priority} className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-gray-700">
                  <div className="flex items-center gap-2"><Pill value={group.priority} tone="priority" /><h3 className="font-semibold text-[#1E3A8A] dark:text-white">Priority Events</h3></div>
                  <span className="text-sm text-slate-500">{group.items.length}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-gray-700">
                  {group.items.map(item => (
                    <div key={item.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div>
                        <p className="font-semibold text-[#1E3A8A] dark:text-white">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{formatDateTime(item.startsAt, item.timezone)} to {formatDateTime(item.endsAt, item.timezone)}</p>
                        <p className="mt-1 text-xs text-slate-500">{labelize(item.eventType)} - {labelize(item.module)}{item.employee ? ` - ${item.employee.name}` : ''}{item.project ? ` - ${item.project.name}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">{item.location && <MapPin className="h-4 w-4" />} {item.location || item.ownerName || 'Workspace event'}</div>
                    </div>
                  ))}
                  {group.items.length === 0 && <p className="p-5 text-sm text-slate-500">No {group.priority} events in this window.</p>}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={submitEvent} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Schedule Event</h3>
            <div className="mt-4 space-y-3">
              <input required value={eventForm.title} onChange={event => setEventForm({ ...eventForm, title: event.target.value })} placeholder="Event title" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <div className="grid grid-cols-2 gap-3">
                <select value={eventForm.eventType} onChange={event => setEventForm({ ...eventForm, eventType: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="meeting">Meeting</option><option value="availability">Availability</option><option value="holiday">Holiday</option><option value="deadline">Deadline</option><option value="audit">Audit</option><option value="tax">Tax filing</option><option value="launch">Launch</option></select>
                <select value={eventForm.priority} onChange={event => setEventForm({ ...eventForm, priority: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="urgent">Urgent</option><option value="standard">Standard</option><option value="informational">Informational</option></select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input required type="datetime-local" value={eventForm.startsAt} onChange={event => setEventForm({ ...eventForm, startsAt: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                <input required type="datetime-local" value={eventForm.endsAt} onChange={event => setEventForm({ ...eventForm, endsAt: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </div>
              <select value={eventForm.employeeId} onChange={event => setEventForm({ ...eventForm, employeeId: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">{employeeOptions}</select>
              <select value={eventForm.projectId} onChange={event => setEventForm({ ...eventForm, projectId: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">{projectOptions}</select>
              <input value={eventForm.location} onChange={event => setEventForm({ ...eventForm, location: event.target.value })} placeholder="Location or channel" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <button disabled={saving === 'event'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Plus className="h-4 w-4" /> Add event</button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'milestones' && (
        <section className="grid gap-4 xl:grid-cols-[1fr_390px]">
          <div className="space-y-4">
            {groupByPriority(milestoneList).map(group => (
              <div key={group.priority} className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-gray-700">
                  <div className="flex items-center gap-2"><Pill value={group.priority} tone="priority" /><h3 className="font-semibold text-[#1E3A8A] dark:text-white">Timeline Milestones</h3></div>
                  <span className="text-sm text-slate-500">{group.items.length}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-gray-700">
                  {group.items.map(item => (
                    <div key={item.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div><p className="font-semibold text-[#1E3A8A] dark:text-white">{item.title}</p><p className="mt-1 text-sm text-slate-500">{formatDateTime(item.dueAt, item.timezone)} - {labelize(item.milestoneType)}{item.project ? ` - ${item.project.name}` : ''}</p></div>
                      <div className="flex items-center gap-2"><Pill value={item.status} />{item.status === 'open' && <button onClick={() => completeMilestone(item.id)} disabled={saving === `milestone-${item.id}`} className="flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700"><Check className="h-3.5 w-3.5" /> Done</button>}</div>
                    </div>
                  ))}
                  {group.items.length === 0 && <p className="p-5 text-sm text-slate-500">No {group.priority} milestones.</p>}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={submitMilestone} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Add Milestone</h3>
            <div className="mt-4 space-y-3">
              <input required value={milestoneForm.title} onChange={event => setMilestoneForm({ ...milestoneForm, title: event.target.value })} placeholder="Milestone title" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <div className="grid grid-cols-2 gap-3">
                <select value={milestoneForm.milestoneType} onChange={event => setMilestoneForm({ ...milestoneForm, milestoneType: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="project">Project</option><option value="audit">Audit</option><option value="tax">Tax filing</option><option value="launch">Launch</option><option value="finance">Finance</option><option value="people">People</option></select>
                <select value={milestoneForm.priority} onChange={event => setMilestoneForm({ ...milestoneForm, priority: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="urgent">Urgent</option><option value="standard">Standard</option><option value="informational">Informational</option></select>
              </div>
              <input required type="datetime-local" value={milestoneForm.dueAt} onChange={event => setMilestoneForm({ ...milestoneForm, dueAt: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <input value={milestoneForm.ownerDepartment} onChange={event => setMilestoneForm({ ...milestoneForm, ownerDepartment: event.target.value })} placeholder="Owner department" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <select value={milestoneForm.projectId} onChange={event => setMilestoneForm({ ...milestoneForm, projectId: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">{projectOptions}</select>
              <button disabled={saving === 'milestone'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Flag className="h-4 w-4" /> Add milestone</button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'conflicts' && (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-slate-200 p-4 dark:border-gray-700"><h3 className="font-semibold text-[#1E3A8A] dark:text-white">Automated Conflict Resolution</h3></div>
          <div className="divide-y divide-slate-100 dark:divide-gray-700">
            {conflictList.map((conflict, index) => (
              <div key={`${conflict.type}-${index}`} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><Pill value={conflict.priority} tone="priority" /><p className="font-semibold text-[#1E3A8A] dark:text-white">{conflict.title}</p></div>
                  <p className="mt-1 text-sm text-slate-500">{conflict.employeeName} - {formatDateTime(conflict.startsAt, conflict.timezone)}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{conflict.recommendation}</p>
                </div>
                <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium capitalize text-slate-600">{labelize(conflict.type)}</span>
              </div>
            ))}
            {conflictList.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No double-booked calendar events detected.</p>}
          </div>
        </section>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-4 w-4 text-[#64748B]" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-semibold text-[#1E3A8A] dark:text-white">Temporal standard</p>
            <p className="mt-1 text-sm text-slate-500">Schedule records display as YYYY-MM-DD HH:mm with the stored timezone, defaulting to {timezone}.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

