import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  BadgeIndianRupee,
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  ClipboardCheck,
  Clock3,
  Eye,
  EyeOff,
  FileCheck2,
  Fingerprint,
  KeyRound,
  Laptop,
  ListChecks,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { apiDelete, apiPost, apiPut, formatCurrency, formatDate, useApi } from '../hooks/useApi'
import { useRole } from '../context/RoleContext'

type Employee = {
  id: number
  employeeId: string
  name: string
  email?: string | null
  phone?: string | null
  role?: string | null
  department?: string | null
  managerName?: string | null
  workLocation?: string | null
  employmentType: string
  monthlyCost: number
  annualCost: number
  annualPtoDays: number
  startDate?: string | null
  status: string
  leaveRequests?: Array<{ id: number }>
  attendanceLogs?: Array<{ id: number; status: string; workDate: string }>
  lifecycleTasks?: Array<{ id: number }>
  user?: {
    id: number
    email: string
    role: 'admin' | 'employee'
    isActive: boolean
    lastLogin?: string | null
    createdAt: string
  } | null
}

type PeopleSummary = {
  headcount: number
  onLeaveCount: number
  contractorCount: number
  monthlyPeopleCost: number
  annualPeopleCost: number
  pendingLeave: number
  usedPtoDays: number
  attendanceToday: Array<{ status: string; count: number }>
  openLifecycleTasks: number
  latestPayrollBatch: PayrollBatch | null
  byDepartment: Array<{ department: string; count: number; monthlyCost: number }>
}

type LeaveRequest = {
  id: number
  requestId: string
  employee: Employee
  leaveType: string
  startDate: string
  endDate: string
  days: number
  status: string
  reason?: string | null
  approverName?: string | null
}

type PtoBalance = {
  employeeId: number
  employeeCode: string
  name: string
  department?: string | null
  allowance: number
  used: number
  balance: number
}

type AttendanceLog = {
  id: number
  employee: Employee
  workDate: string
  workMode: string
  geoFenceStatus: string
  regularHours: number
  overtimeHours: number
  status: string
  notes?: string | null
}

type LifecycleTask = {
  id: number
  taskId: string
  employee?: Employee | null
  taskType: string
  ownerTeam: string
  title: string
  dueDate?: string | null
  status: string
  checklist?: string | null
}

type PayrollBatch = {
  id: number
  batchId: string
  periodStart: string
  periodEnd: string
  status: string
  employeeCount: number
  grossPay: number
  approvedExpenses: number
  bonuses: number
  deductions: number
  netPay: number
  notes?: string | null
  employees?: Array<{
    id: number
    employee: Employee
    basePay: number
    expenseReimbursements: number
    bonus: number
    deductions: number
    netPay: number
  }>
}

type AdminUser = {
  id: number
  email: string
  name: string
  role: 'admin'
  isActive: boolean
  lastLogin?: string | null
  createdAt: string
}

type LoginUser = {
  id: number
  email: string
  name?: string | null
  role: 'admin' | 'employee'
  employeeId?: number | null
  isActive: boolean
  lastLogin?: string | null
  createdAt: string
  employee?: {
    id: number
    employeeId: string
    name: string
    department?: string | null
    status: string
    isArchived: boolean
  } | null
}

const today = new Date().toISOString().slice(0, 10)
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10)

const employeeDefaults = {
  name: '',
  email: '',
  phone: '',
  role: '',
  department: '',
  managerName: '',
  workLocation: '',
  employmentType: 'full_time',
  monthlyCost: '',
  annualPtoDays: '18',
  startDate: today,
}

const leaveDefaults = {
  employeeId: '',
  leaveType: 'paid_time_off',
  startDate: today,
  endDate: today,
  days: '1',
  reason: '',
  approverName: '',
  blackoutChecked: true,
}

const attendanceDefaults = {
  employeeId: '',
  workDate: today,
  checkIn: `${today}T09:30`,
  checkOut: `${today}T18:30`,
  workMode: 'office',
  geoFenceStatus: 'verified',
  regularHours: '8',
  overtimeHours: '0',
  status: 'present',
  notes: '',
}

const lifecycleDefaults = {
  employeeId: '',
  taskType: 'onboarding',
  ownerTeam: 'HR',
  title: '',
  dueDate: today,
  checklist: '',
}

const payrollDefaults = {
  periodStart: monthStart,
  periodEnd: monthEnd,
  bonuses: '0',
  deductions: '0',
  status: 'draft',
  notes: '',
}

const adminDefaults = {
  name: '',
  email: '',
  password: '',
}

const tabs = [
  { id: 'directory', label: 'Directory', icon: Users },
  { id: 'leave', label: 'Leave', icon: CalendarCheck2 },
  { id: 'attendance', label: 'Attendance', icon: Clock3 },
  { id: 'lifecycle', label: 'Lifecycle', icon: ListChecks },
  { id: 'payroll', label: 'Payroll', icon: BadgeIndianRupee },
  { id: 'users', label: 'Users', icon: KeyRound },
  { id: 'admins', label: 'Admins', icon: ShieldCheck },
]

const statusTone: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  complete: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  in_progress: 'bg-slate-100 text-slate-700 border-slate-200',
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  blocked: 'bg-red-50 text-red-700 border-red-200',
}

const labelize = (value?: string | null) => (value || 'unassigned').replace(/_/g, ' ')

function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium capitalize ${statusTone[value] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
      {labelize(value)}
    </span>
  )
}

function MetricCard({ icon: Icon, label, value, caption }: { icon: any; label: string; value: string; caption: string }) {
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

export default function People() {
  const { isAdmin, user } = useRole()
  const [activeTab, setActiveTab] = useState('directory')
  const [search, setSearch] = useState('')
  const [showCompensation, setShowCompensation] = useState(false)
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false)
  const [employeeForm, setEmployeeForm] = useState(employeeDefaults)
  const [leaveForm, setLeaveForm] = useState(leaveDefaults)
  const [attendanceDate, setAttendanceDate] = useState(today)
  const [attendanceForm, setAttendanceForm] = useState(attendanceDefaults)
  const [lifecycleForm, setLifecycleForm] = useState(lifecycleDefaults)
  const [payrollForm, setPayrollForm] = useState(payrollDefaults)
  const [adminForm, setAdminForm] = useState(adminDefaults)
  const [selectedPayrollId, setSelectedPayrollId] = useState<number | null>(null)
  const [editingPayrollId, setEditingPayrollId] = useState<number | null>(null)
  const [payrollEditForm, setPayrollEditForm] = useState(payrollDefaults)
  const [saving, setSaving] = useState('')
  const [message, setMessage] = useState('')

  const { data: summary, refetch: refetchSummary } = useApi<PeopleSummary>('/employees/summary')
  const { data: employees, loading: employeesLoading, refetch: refetchEmployees } = useApi<Employee[]>(`/employees?status=all&search=${encodeURIComponent(search)}`)
  const { data: leaveRequests, refetch: refetchLeave } = useApi<LeaveRequest[]>('/employees/leave')
  const { data: ptoBalances, refetch: refetchBalances } = useApi<PtoBalance[]>('/employees/leave/balances')
  const { data: attendanceLogs, refetch: refetchAttendance } = useApi<AttendanceLog[]>(`/employees/attendance?date=${attendanceDate}`)
  const { data: lifecycleTasks, refetch: refetchLifecycle } = useApi<LifecycleTask[]>(isAdmin ? '/employees/lifecycle' : null)
  const { data: payrollBatches, refetch: refetchPayroll } = useApi<PayrollBatch[]>(isAdmin ? '/employees/payroll-batches' : null)
  const { data: loginUsers, refetch: refetchUsers } = useApi<LoginUser[]>(isAdmin ? '/auth/users' : null)
  const { data: adminUsers, refetch: refetchAdmins } = useApi<AdminUser[]>(isAdmin ? '/auth/admins' : null)

  const employeeList = employees || []
  const leaveList = leaveRequests || []
  const balances = ptoBalances || []
  const attendanceList = attendanceLogs || []
  const lifecycleList = lifecycleTasks || []
  const payrollList = payrollBatches || []
  const userList = loginUsers || []
  const adminList = adminUsers || []
  const selectedPayroll = payrollList.find(batch => batch.id === selectedPayrollId) || payrollList[0] || null
  const visibleTabs = useMemo(() => (
    isAdmin ? tabs : tabs.filter(tab => ['directory', 'leave', 'attendance'].includes(tab.id))
  ), [isAdmin])
  const canViewCompensation = isAdmin && showCompensation
  const canSubmitAttendance = isAdmin ? employeeList.length > 0 : Boolean(user?.employeeId)

  useEffect(() => {
    if (!visibleTabs.some(tab => tab.id === activeTab)) {
      setActiveTab('directory')
    }
  }, [activeTab, visibleTabs])

  useEffect(() => {
    if (!isAdmin && user?.employeeId && attendanceForm.employeeId !== String(user.employeeId)) {
      setAttendanceForm(form => ({ ...form, employeeId: String(user.employeeId) }))
    }
  }, [attendanceForm.employeeId, isAdmin, user?.employeeId])

  const presentToday = useMemo(() => {
    return summary?.attendanceToday.find(item => item.status === 'present')?.count || 0
  }, [summary])

  const refreshPeople = async () => {
    await Promise.all([
      refetchSummary(),
      refetchEmployees(),
      refetchLeave(),
      refetchBalances(),
      refetchAttendance(),
      refetchLifecycle(),
      refetchPayroll(),
      refetchUsers(),
      refetchAdmins(),
    ])
  }

  const submitEmployee = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('employee')
    setMessage('')
    try {
      await apiPost('/employees', employeeForm)
      setEmployeeForm(employeeDefaults)
      setEmployeeFormOpen(false)
      setMessage('Employee profile and login user created.')
      await refreshPeople()
    } catch (error: any) {
      setMessage(error.message || 'Could not create employee profile.')
    } finally {
      setSaving('')
    }
  }

  const submitAdmin = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('admin')
    setMessage('')
    try {
      await apiPost('/auth/admins', adminForm)
      setAdminForm(adminDefaults)
      setMessage('Admin login user created.')
      await refreshPeople()
    } catch (error: any) {
      setMessage(error.message || 'Could not create admin user.')
    } finally {
      setSaving('')
    }
  }

  const submitLeave = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('leave')
    setMessage('')
    try {
      await apiPost('/employees/leave', leaveForm)
      setLeaveForm(leaveDefaults)
      setMessage('Leave request captured for HR review.')
      await refreshPeople()
    } catch (error: any) {
      setMessage(error.message || 'Could not save leave request.')
    } finally {
      setSaving('')
    }
  }

  const updateLeaveStatus = async (requestId: number, status: string) => {
    setSaving(`leave-${requestId}`)
    setMessage('')
    try {
      await apiPut(`/employees/leave/${requestId}/status`, { status, approverName: 'HR Admin', blackoutChecked: true })
      setMessage(`Leave request ${status}.`)
      await refreshPeople()
    } catch (error: any) {
      setMessage(error.message || 'Could not update leave request.')
    } finally {
      setSaving('')
    }
  }

  const submitAttendance = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('attendance')
    setMessage('')
    try {
      await apiPost('/employees/attendance', attendanceForm)
      setAttendanceDate(attendanceForm.workDate)
      setMessage('Attendance log recorded.')
      await refreshPeople()
    } catch (error: any) {
      setMessage(error.message || 'Could not record attendance.')
    } finally {
      setSaving('')
    }
  }

  const submitLifecycle = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('lifecycle')
    setMessage('')
    try {
      await apiPost('/employees/lifecycle', lifecycleForm)
      setLifecycleForm(lifecycleDefaults)
      setMessage('Lifecycle task added.')
      await refreshPeople()
    } catch (error: any) {
      setMessage(error.message || 'Could not add lifecycle task.')
    } finally {
      setSaving('')
    }
  }

  const updateLifecycleStatus = async (taskId: number, status: string) => {
    setSaving(`task-${taskId}`)
    setMessage('')
    try {
      await apiPut(`/employees/lifecycle/${taskId}`, { status })
      setMessage('Lifecycle task updated.')
      await refreshPeople()
    } catch (error: any) {
      setMessage(error.message || 'Could not update lifecycle task.')
    } finally {
      setSaving('')
    }
  }

  const submitPayroll = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('payroll')
    setMessage('')
    try {
      await apiPost('/employees/payroll-batches', payrollForm)
      setPayrollForm(payrollDefaults)
      setMessage('Draft payroll batch prepared.')
      await refreshPeople()
    } catch (error: any) {
      setMessage(error.message || 'Could not prepare payroll batch.')
    } finally {
      setSaving('')
    }
  }

  const startEditPayroll = (batch: PayrollBatch) => {
    setEditingPayrollId(batch.id)
    setSelectedPayrollId(batch.id)
    setPayrollEditForm({
      periodStart: batch.periodStart.slice(0, 10),
      periodEnd: batch.periodEnd.slice(0, 10),
      bonuses: String(batch.bonuses || 0),
      deductions: String(batch.deductions || 0),
      status: batch.status || 'draft',
      notes: batch.notes || '',
    })
  }

  const updatePayroll = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingPayrollId) return
    setSaving(`payroll-update-${editingPayrollId}`)
    setMessage('')
    try {
      await apiPut(`/employees/payroll-batches/${editingPayrollId}`, payrollEditForm)
      setEditingPayrollId(null)
      setMessage('Payroll batch updated.')
      await refreshPeople()
    } catch (error: any) {
      setMessage(error.message || 'Could not update payroll batch.')
    } finally {
      setSaving('')
    }
  }

  const deletePayroll = async (batch: PayrollBatch) => {
    if (!window.confirm(`Delete payroll batch ${batch.batchId}? This removes the batch and its payroll line items.`)) return
    setSaving(`payroll-delete-${batch.id}`)
    setMessage('')
    try {
      await apiDelete(`/employees/payroll-batches/${batch.id}`)
      if (selectedPayrollId === batch.id) setSelectedPayrollId(null)
      if (editingPayrollId === batch.id) setEditingPayrollId(null)
      setMessage('Payroll batch deleted.')
      await refreshPeople()
    } catch (error: any) {
      setMessage(error.message || 'Could not delete payroll batch.')
    } finally {
      setSaving('')
    }
  }

  const removeEmployee = async (employee: Employee) => {
    if (!window.confirm(`Remove ${employee.name}? This archives the employee profile and disables their login access.`)) return
    setSaving(`employee-delete-${employee.id}`)
    setMessage('')
    try {
      await apiDelete(`/employees/${employee.id}`)
      setMessage('Employee removed and login access disabled.')
      await refreshPeople()
    } catch (error: any) {
      setMessage(error.message || 'Could not remove employee.')
    } finally {
      setSaving('')
    }
  }

  const renderEmployeeOptions = () => (
    <>
      <option value="">Select employee</option>
      {employeeList.map(employee => (
        <option key={employee.id} value={employee.id}>{employee.name} - {employee.employeeId}</option>
      ))}
    </>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#64748B]">Teinco-X People</p>
          <h2 className="mt-1 text-[32px] font-semibold leading-tight text-[#1E3A8A] dark:text-white">People Operations</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Unified HR records, leave approvals, attendance evidence, lifecycle tasks, and payroll preparation.
          </p>
          {!isAdmin && (
            <p className="mt-2 inline-flex rounded-lg border border-[#EFF6FF] bg-[#EFF6FF] px-3 py-1.5 text-xs font-medium text-[#1E3A8A]">
              Employee mode: leave, attendance, and directory access only.
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCompensation(value => !value)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-[#1E3A8A] shadow-sm hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              title="Toggle compensation visibility for authorized HR users"
            >
              {showCompensation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showCompensation ? 'Hide compensation' : 'HR compensation view'}
            </button>
            <button
              onClick={() => setEmployeeFormOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              <UserPlus className="h-4 w-4" />
              Add employee
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Active headcount" value={String(summary?.headcount || 0)} caption={`${summary?.contractorCount || 0} contractors tracked`} />
        <MetricCard icon={CalendarCheck2} label="Pending leave" value={String(summary?.pendingLeave || 0)} caption={`${summary?.usedPtoDays || 0} PTO days used this year`} />
        <MetricCard icon={Fingerprint} label="Attendance today" value={String(presentToday)} caption={`${summary?.onLeaveCount || 0} employees marked on leave`} />
        <MetricCard icon={ShieldCheck} label="Monthly people cost" value={canViewCompensation ? formatCurrency(summary?.monthlyPeopleCost || 0) : 'Restricted'} caption={isAdmin ? 'Visible to HR and direct managers' : 'Admin only'} />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-gray-700">
        {visibleTabs.map(tab => (
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

      {activeTab === 'directory' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search employees, roles, departments..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <p className="text-sm text-slate-500">{employeeList.length} records</p>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-gray-700/50 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Employee</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Manager</th>
                    <th className="px-4 py-3 font-medium">Employment</th>
                    <th className="px-4 py-3 font-medium text-right">Monthly cost</th>
                    {isAdmin && <th className="px-4 py-3 font-medium">Login</th>}
                    <th className="px-4 py-3 font-medium">Status</th>
                    {isAdmin && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                  {employeeList.map(employee => (
                    <tr key={employee.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1E3A8A] dark:text-white">{employee.name}</p>
                        <p className="text-xs text-slate-500">{employee.employeeId} {employee.email ? `- ${employee.email}` : ''}</p>
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-300">{employee.department || 'Unassigned'}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{employee.managerName || '-'}</td>
                      <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-300">{labelize(employee.employmentType)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#1E3A8A] dark:text-white">
                        {canViewCompensation ? formatCurrency(employee.monthlyCost) : 'Restricted'}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {employee.user ? (
                            <div>
                              <StatusBadge value={employee.user.isActive ? 'active' : 'blocked'} />
                              <p className="mt-1 text-xs text-slate-500">{employee.user.email}</p>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-500">No login</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3"><StatusBadge value={employee.status} /></td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeEmployee(employee)}
                            disabled={saving === `employee-delete-${employee.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!employeesLoading && employeeList.length === 0 && (
              <div className="p-10 text-center">
                <Users className="mx-auto h-10 w-10 text-slate-300" strokeWidth={1.5} />
                <p className="mt-3 font-medium text-[#1E3A8A] dark:text-white">No employee records yet</p>
                <p className="mt-1 text-sm text-slate-500">Add your first profile to activate leave, attendance, and payroll workflows.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'leave' && (
        <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700">
              <h3 className="font-semibold text-[#1E3A8A] dark:text-white">PTO Balances</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-gray-700/50">
                  <tr><th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium">Allowance</th><th className="px-4 py-3 font-medium">Used</th><th className="px-4 py-3 font-medium">Balance</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                  {balances.map(balance => (
                    <tr key={balance.employeeId}>
                      <td className="px-4 py-3"><span className="font-medium text-[#1E3A8A] dark:text-white">{balance.name}</span><span className="block text-xs text-slate-500">{balance.employeeCode}</span></td>
                      <td className="px-4 py-3">{balance.allowance}</td>
                      <td className="px-4 py-3">{balance.used}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">{balance.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {balances.length === 0 && <p className="p-8 text-center text-sm text-slate-500">PTO balances appear after employees are added.</p>}
          </div>

          <form onSubmit={submitLeave} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Leave Application</h3>
            <div className="mt-4 space-y-3">
              <select required value={leaveForm.employeeId} onChange={event => setLeaveForm({ ...leaveForm, employeeId: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">{renderEmployeeOptions()}</select>
              <select value={leaveForm.leaveType} onChange={event => setLeaveForm({ ...leaveForm, leaveType: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                <option value="paid_time_off">Paid time off</option><option value="sick">Sick leave</option><option value="unpaid">Unpaid leave</option><option value="parental">Parental leave</option><option value="comp_off">Comp off</option>
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input required type="date" value={leaveForm.startDate} onChange={event => setLeaveForm({ ...leaveForm, startDate: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                <input required type="date" value={leaveForm.endDate} onChange={event => setLeaveForm({ ...leaveForm, endDate: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </div>
              <input required min="0.5" step="0.5" type="number" value={leaveForm.days} onChange={event => setLeaveForm({ ...leaveForm, days: event.target.value })} placeholder="Days" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <textarea value={leaveForm.reason} onChange={event => setLeaveForm({ ...leaveForm, reason: event.target.value })} placeholder="Reason or coverage note" className="h-20 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><input type="checkbox" checked={leaveForm.blackoutChecked} onChange={event => setLeaveForm({ ...leaveForm, blackoutChecked: event.target.checked })} /> Blackout dates checked</label>
              <button disabled={saving === 'leave' || employeeList.length === 0} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                <Plus className="h-4 w-4" /> Submit request
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 xl:col-span-2">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700"><h3 className="font-semibold text-[#1E3A8A] dark:text-white">{isAdmin ? 'Leave Queue' : 'My Leave Requests'}</h3></div>
            <div className="divide-y divide-slate-100 dark:divide-gray-700">
              {leaveList.map(request => (
                <div key={request.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-[#1E3A8A] dark:text-white">{request.employee?.name} - {labelize(request.leaveType)}</p>
                    <p className="text-sm text-slate-500">{formatDate(request.startDate)} to {formatDate(request.endDate)} - {request.days} days</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={request.status} />
                    {request.status === 'pending' && (
                      <>
                        {isAdmin && (
                          <>
                            <button onClick={() => updateLeaveStatus(request.id, 'approved')} disabled={saving === `leave-${request.id}`} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700">Approve</button>
                            <button onClick={() => updateLeaveStatus(request.id, 'rejected')} disabled={saving === `leave-${request.id}`} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700">Reject</button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
              {leaveList.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No leave requests yet.</p>}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'attendance' && (
        <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold text-[#1E3A8A] dark:text-white">{isAdmin ? 'Daily Attendance' : 'My Attendance'}</h3>
              <input type="date" value={attendanceDate} onChange={event => setAttendanceDate(event.target.value)} className="rounded-lg border p-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>
            <div className="divide-y divide-slate-100 dark:divide-gray-700">
              {attendanceList.map(log => (
                <div key={log.id} className="grid gap-3 p-4 md:grid-cols-[1.3fr_1fr_1fr_auto] md:items-center">
                  <div><p className="font-semibold text-[#1E3A8A] dark:text-white">{log.employee?.name}</p><p className="text-xs text-slate-500">{log.employee?.department || 'Unassigned'}</p></div>
                  <p className="capitalize text-slate-700 dark:text-slate-300">{labelize(log.workMode)} - {labelize(log.geoFenceStatus)}</p>
                  <p className="text-slate-700 dark:text-slate-300">{log.regularHours}h regular, {log.overtimeHours}h OT</p>
                  <StatusBadge value={log.status} />
                </div>
              ))}
              {attendanceList.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No attendance logs for this date.</p>}
            </div>
          </div>

          <form onSubmit={submitAttendance} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-[#1E3A8A] dark:text-white">{isAdmin ? 'Record Attendance' : 'Mark My Attendance'}</h3>
            {!isAdmin && <p className="mt-1 text-sm text-slate-500">Your attendance is linked to your employee login automatically.</p>}
            <div className="mt-4 space-y-3">
              {isAdmin ? (
                <select required value={attendanceForm.employeeId} onChange={event => setAttendanceForm({ ...attendanceForm, employeeId: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">{renderEmployeeOptions()}</select>
              ) : (
                <div className="rounded-lg border border-[#EFF6FF] bg-[#EFF6FF] p-3 text-sm text-[#1E3A8A]">
                  {employeeList[0]?.name || user?.name || 'Employee'} · {employeeList[0]?.employeeId || 'Linked profile'}
                </div>
              )}
              <input required type="date" value={attendanceForm.workDate} onChange={event => setAttendanceForm({ ...attendanceForm, workDate: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <div className="grid grid-cols-2 gap-3">
                <input type="datetime-local" value={attendanceForm.checkIn} onChange={event => setAttendanceForm({ ...attendanceForm, checkIn: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                <input type="datetime-local" value={attendanceForm.checkOut} onChange={event => setAttendanceForm({ ...attendanceForm, checkOut: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input min="0" step="0.25" type="number" value={attendanceForm.regularHours} onChange={event => setAttendanceForm({ ...attendanceForm, regularHours: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                <input min="0" step="0.25" type="number" value={attendanceForm.overtimeHours} onChange={event => setAttendanceForm({ ...attendanceForm, overtimeHours: event.target.value })} className="rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </div>
              <select value={attendanceForm.workMode} onChange={event => setAttendanceForm({ ...attendanceForm, workMode: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="office">Office</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="field">Field</option></select>
              <select value={attendanceForm.status} onChange={event => setAttendanceForm({ ...attendanceForm, status: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="present">Present</option><option value="leave">Leave</option><option value="lwop">Leave without pay</option><option value="absent">Absent</option><option value="holiday">Holiday</option></select>
              <button disabled={saving === 'attendance' || !canSubmitAttendance} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                <Clock3 className="h-4 w-4" /> Save attendance
              </button>
              {!canSubmitAttendance && <p className="text-xs text-red-600">This login is not linked to an employee profile yet. Ask an admin to add your email in People.</p>}
            </div>
          </form>
        </section>
      )}

      {activeTab === 'lifecycle' && (
        <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700"><h3 className="font-semibold text-[#1E3A8A] dark:text-white">Onboarding & Offboarding Checklist</h3></div>
            <div className="divide-y divide-slate-100 dark:divide-gray-700">
              {lifecycleList.map(task => (
                <div key={task.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-[#1E3A8A] dark:text-white">{task.title}</p>
                    <p className="text-sm text-slate-500">{task.employee?.name || 'General task'} - {task.ownerTeam} - {task.dueDate ? formatDate(task.dueDate) : 'No due date'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={task.status} />
                    {task.status !== 'complete' && <button onClick={() => updateLifecycleStatus(task.id, 'complete')} disabled={saving === `task-${task.id}`} className="flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-sm font-medium text-emerald-700"><Check className="h-3.5 w-3.5" /> Done</button>}
                  </div>
                </div>
              ))}
              {lifecycleList.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No lifecycle tasks yet.</p>}
            </div>
          </div>

          <form onSubmit={submitLifecycle} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Create Checklist Item</h3>
            <div className="mt-4 space-y-3">
              <select value={lifecycleForm.employeeId} onChange={event => setLifecycleForm({ ...lifecycleForm, employeeId: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white">{renderEmployeeOptions()}</select>
              <select value={lifecycleForm.taskType} onChange={event => setLifecycleForm({ ...lifecycleForm, taskType: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="onboarding">Onboarding</option><option value="offboarding">Offboarding</option></select>
              <select value={lifecycleForm.ownerTeam} onChange={event => setLifecycleForm({ ...lifecycleForm, ownerTeam: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option>HR</option><option>IT</option><option>Finance</option><option>Manager</option></select>
              <input required value={lifecycleForm.title} onChange={event => setLifecycleForm({ ...lifecycleForm, title: event.target.value })} placeholder="Task title" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <input type="date" value={lifecycleForm.dueDate} onChange={event => setLifecycleForm({ ...lifecycleForm, dueDate: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <textarea value={lifecycleForm.checklist} onChange={event => setLifecycleForm({ ...lifecycleForm, checklist: event.target.value })} placeholder="Checklist notes" className="h-20 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              <button disabled={saving === 'lifecycle'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                <ClipboardCheck className="h-4 w-4" /> Add task
              </button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'payroll' && (
        <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700"><h3 className="font-semibold text-[#1E3A8A] dark:text-white">Payroll Batches</h3></div>
            <div className="divide-y divide-slate-100 dark:divide-gray-700">
              {payrollList.map(batch => (
                <div key={batch.id} className={`grid gap-3 p-4 transition-colors md:grid-cols-[1.2fr_0.8fr_1fr_auto] md:items-center ${selectedPayrollId === batch.id ? 'bg-[#EFF6FF]' : ''}`}>
                  <button type="button" onClick={() => setSelectedPayrollId(batch.id)} className="text-left">
                    <p className="font-semibold text-[#1E3A8A] dark:text-white">{batch.batchId}</p>
                    <p className="text-xs text-slate-500">{formatDate(batch.periodStart)} to {formatDate(batch.periodEnd)}</p>
                  </button>
                  <p className="text-slate-700 dark:text-slate-300">{batch.employeeCount} employees</p>
                  <p className="font-semibold text-[#1E3A8A] dark:text-white">{canViewCompensation ? formatCurrency(batch.netPay) : 'Restricted'}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={batch.status} />
                    <button type="button" onClick={() => setSelectedPayrollId(batch.id)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-slate-200">View</button>
                    <button type="button" onClick={() => startEditPayroll(batch)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-[#1E3A8A] hover:bg-slate-50 dark:border-gray-700 dark:text-slate-200"><Pencil className="inline h-3.5 w-3.5" /> Edit</button>
                    <button type="button" onClick={() => deletePayroll(batch)} disabled={saving === `payroll-delete-${batch.id}`} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="inline h-3.5 w-3.5" /> Delete</button>
                  </div>
                </div>
              ))}
              {payrollList.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No payroll batches prepared yet.</p>}
            </div>
          </div>

          <div className="space-y-4">
            {selectedPayroll && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Payroll Details</h3>
                    <p className="mt-1 text-sm text-slate-500">{selectedPayroll.batchId} · {formatDate(selectedPayroll.periodStart)} to {formatDate(selectedPayroll.periodEnd)}</p>
                  </div>
                  <StatusBadge value={selectedPayroll.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Gross pay</p><p className="font-semibold text-[#1E3A8A]">{canViewCompensation ? formatCurrency(selectedPayroll.grossPay) : 'Restricted'}</p></div>
                  <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Reimbursements</p><p className="font-semibold text-[#1E3A8A]">{canViewCompensation ? formatCurrency(selectedPayroll.approvedExpenses) : 'Restricted'}</p></div>
                  <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Bonuses</p><p className="font-semibold text-[#1E3A8A]">{canViewCompensation ? formatCurrency(selectedPayroll.bonuses) : 'Restricted'}</p></div>
                  <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Deductions</p><p className="font-semibold text-[#1E3A8A]">{canViewCompensation ? formatCurrency(selectedPayroll.deductions) : 'Restricted'}</p></div>
                  <div className="col-span-2 rounded-lg bg-[#EFF6FF] p-3"><p className="text-xs text-slate-500">Net pay</p><p className="text-lg font-semibold text-[#1E3A8A]">{canViewCompensation ? formatCurrency(selectedPayroll.netPay) : 'Restricted'}</p></div>
                </div>
                {selectedPayroll.notes && <p className="mt-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-600">{selectedPayroll.notes}</p>}
                <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-slate-200">
                  {(selectedPayroll.employees || []).map(line => (
                    <div key={line.id} className="flex items-center justify-between border-b border-slate-100 px-3 py-2 last:border-b-0">
                      <div><p className="text-sm font-medium text-slate-900">{line.employee.name}</p><p className="text-xs text-slate-500">{line.employee.employeeId} · {line.employee.department || 'Unassigned'}</p></div>
                      <p className="text-sm font-semibold text-[#1E3A8A]">{canViewCompensation ? formatCurrency(line.netPay) : 'Restricted'}</p>
                    </div>
                  ))}
                  {(selectedPayroll.employees || []).length === 0 && <p className="p-3 text-sm text-slate-500">No employee line items in this batch.</p>}
                </div>
              </div>
            )}

            {editingPayrollId ? (
              <form onSubmit={updatePayroll} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Edit Payroll Batch</h3>
                <p className="mt-1 text-sm text-slate-500">Updating dates recalculates active employee pay and reimbursement totals.</p>
                <div className="mt-4 space-y-3">
                  <input required type="date" value={payrollEditForm.periodStart} onChange={event => setPayrollEditForm({ ...payrollEditForm, periodStart: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                  <input required type="date" value={payrollEditForm.periodEnd} onChange={event => setPayrollEditForm({ ...payrollEditForm, periodEnd: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                  <select value={payrollEditForm.status} onChange={event => setPayrollEditForm({ ...payrollEditForm, status: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="draft">Draft</option><option value="locked">Locked</option><option value="exported">Exported</option></select>
                  <input min="0" step="0.01" type="number" value={payrollEditForm.bonuses} onChange={event => setPayrollEditForm({ ...payrollEditForm, bonuses: event.target.value })} placeholder="Bonuses" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                  <input min="0" step="0.01" type="number" value={payrollEditForm.deductions} onChange={event => setPayrollEditForm({ ...payrollEditForm, deductions: event.target.value })} placeholder="Deductions" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                  <textarea value={payrollEditForm.notes} onChange={event => setPayrollEditForm({ ...payrollEditForm, notes: event.target.value })} placeholder="Payroll notes" className="h-20 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setEditingPayrollId(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                    <button disabled={saving === `payroll-update-${editingPayrollId}`} className="flex items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                      <FileCheck2 className="h-4 w-4" /> Save changes
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={submitPayroll} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Prepare Payroll</h3>
                <p className="mt-1 text-sm text-slate-500">Combines active employee pay and approved reimbursement expenses from Ledger.</p>
                <div className="mt-4 space-y-3">
                  <input required type="date" value={payrollForm.periodStart} onChange={event => setPayrollForm({ ...payrollForm, periodStart: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                  <input required type="date" value={payrollForm.periodEnd} onChange={event => setPayrollForm({ ...payrollForm, periodEnd: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                  <select value={payrollForm.status} onChange={event => setPayrollForm({ ...payrollForm, status: event.target.value })} className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"><option value="draft">Draft</option><option value="locked">Locked</option><option value="exported">Exported</option></select>
                  <input min="0" step="0.01" type="number" value={payrollForm.bonuses} onChange={event => setPayrollForm({ ...payrollForm, bonuses: event.target.value })} placeholder="Bonuses" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                  <input min="0" step="0.01" type="number" value={payrollForm.deductions} onChange={event => setPayrollForm({ ...payrollForm, deductions: event.target.value })} placeholder="Deductions" className="w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                  <textarea value={payrollForm.notes} onChange={event => setPayrollForm({ ...payrollForm, notes: event.target.value })} placeholder="Payroll notes" className="h-20 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
                  <button disabled={saving === 'payroll'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    <FileCheck2 className="h-4 w-4" /> Create draft batch
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      )}

      {activeTab === 'users' && (
        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700">
              <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Login Users</h3>
              <p className="mt-1 text-sm text-slate-500">Secure view of account access for admins and employee logins. Passwords and setup values are never shown.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-gray-700/50 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Linked employee</th>
                    <th className="px-4 py-3 font-medium">Last login</th>
                    <th className="px-4 py-3 font-medium">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-700">
                  {userList.map(loginUser => (
                    <tr key={loginUser.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/40">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1E3A8A] dark:text-white">{loginUser.name || 'Unnamed user'}</p>
                        <p className="text-xs text-slate-500">{loginUser.email}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge value={loginUser.role} /></td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {loginUser.employee ? (
                          <div>
                            <p className="font-medium">{loginUser.employee.name}</p>
                            <p className="text-xs text-slate-500">{loginUser.employee.employeeId} · {loginUser.employee.department || 'Unassigned'} · {labelize(loginUser.employee.status)}</p>
                          </div>
                        ) : (
                          <span className="text-slate-500">{loginUser.role === 'admin' ? 'Admin account' : 'Not linked'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{loginUser.lastLogin ? formatDate(loginUser.lastLogin) : 'No login yet'}</td>
                      <td className="px-4 py-3"><StatusBadge value={loginUser.isActive ? 'active' : 'blocked'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {userList.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No login users found.</p>}
          </div>
        </section>
      )}

      {activeTab === 'admins' && (
        <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-slate-200 p-4 dark:border-gray-700">
              <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Admin Users</h3>
              <p className="mt-1 text-sm text-slate-500">Admins can manage company data, payroll, users, and workspace settings.</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-gray-700">
              {adminList.map(admin => (
                <div key={admin.id} className="grid gap-3 p-4 md:grid-cols-[1fr_0.8fr_auto] md:items-center">
                  <div>
                    <p className="font-semibold text-[#1E3A8A] dark:text-white">{admin.name}</p>
                    <p className="text-xs text-slate-500">{admin.email}</p>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    <p>Created {formatDate(admin.createdAt)}</p>
                    <p className="text-xs text-slate-500">{admin.lastLogin ? `Last login ${formatDate(admin.lastLogin)}` : 'No login yet'}</p>
                  </div>
                  <StatusBadge value={admin.isActive ? 'active' : 'blocked'} />
                </div>
              ))}
              {adminList.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No admin users found.</p>}
            </div>
          </div>

          <form onSubmit={submitAdmin} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-[#EFF6FF] p-2 text-[#1E3A8A]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-[#1E3A8A] dark:text-white">Add Admin</h3>
                <p className="mt-1 text-sm text-slate-500">Create a new admin account with full workspace access.</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Full name
                <input
                  required
                  value={adminForm.name}
                  onChange={event => setAdminForm({ ...adminForm, name: event.target.value })}
                  className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Email
                <input
                  required
                  type="email"
                  value={adminForm.email}
                  onChange={event => setAdminForm({ ...adminForm, email: event.target.value })}
                  className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Initial password
                <input
                  required
                  minLength={6}
                  type="password"
                  value={adminForm.password}
                  onChange={event => setAdminForm({ ...adminForm, password: event.target.value })}
                  className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
              <button disabled={saving === 'admin'} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                <ShieldCheck className="h-4 w-4" /> {saving === 'admin' ? 'Creating admin...' : 'Create admin'}
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {(summary?.byDepartment || []).map(department => (
          <div key={department.department} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 text-[#64748B]" strokeWidth={1.5} />
              <p className="font-semibold text-[#1E3A8A] dark:text-white">{department.department}</p>
            </div>
            <p className="mt-2 text-sm text-slate-500">{department.count} active employees</p>
            <p className="mt-1 text-sm font-semibold text-[#1E3A8A] dark:text-white">{canViewCompensation ? formatCurrency(department.monthlyCost) : 'Restricted'} monthly cost</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
        <div className="flex items-start gap-3">
          <Laptop className="mt-0.5 h-4 w-4 text-[#64748B]" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-semibold text-[#1E3A8A] dark:text-white">Privacy control</p>
            <p className="mt-1 text-sm text-slate-500">Compensation fields are kept behind the HR compensation view toggle in the interface and are intended only for HR administrators and direct managers.</p>
          </div>
        </div>
      </div>

      {employeeFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4" onMouseDown={() => setEmployeeFormOpen(false)}>
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-2xl dark:bg-gray-800" onMouseDown={event => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-[#1E3A8A] dark:text-white">Create employee profile</h3>
                <p className="text-sm text-slate-500">Saving this profile also creates the employee login user.</p>
              </div>
              <button onClick={() => setEmployeeFormOpen(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-gray-700">Close</button>
            </div>
            <form onSubmit={submitEmployee} className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Full name<input required value={employeeForm.name} onChange={event => setEmployeeForm({ ...employeeForm, name: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Email<input required type="email" value={employeeForm.email} onChange={event => setEmployeeForm({ ...employeeForm, email: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Role<input value={employeeForm.role} onChange={event => setEmployeeForm({ ...employeeForm, role: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Department<input value={employeeForm.department} onChange={event => setEmployeeForm({ ...employeeForm, department: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Manager<input value={employeeForm.managerName} onChange={event => setEmployeeForm({ ...employeeForm, managerName: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Work location<input value={employeeForm.workLocation} onChange={event => setEmployeeForm({ ...employeeForm, workLocation: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Employment type<select value={employeeForm.employmentType} onChange={event => setEmployeeForm({ ...employeeForm, employmentType: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contractor">Contractor</option><option value="freelancer">Freelancer</option><option value="intern">Intern</option></select></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Monthly compensation<input min="0" step="0.01" type="number" value={employeeForm.monthlyCost} onChange={event => setEmployeeForm({ ...employeeForm, monthlyCost: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Annual PTO days<input min="0" step="0.5" type="number" value={employeeForm.annualPtoDays} onChange={event => setEmployeeForm({ ...employeeForm, annualPtoDays: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></label>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Start date<input type="date" value={employeeForm.startDate} onChange={event => setEmployeeForm({ ...employeeForm, startDate: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5 text-sm dark:border-gray-700 dark:bg-gray-900" /></label>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 sm:col-span-2 dark:border-gray-700">
                <button type="button" onClick={() => setEmployeeFormOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
                <button disabled={saving === 'employee'} className="rounded-lg bg-[#1E3A8A] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving === 'employee' ? 'Saving...' : 'Save employee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

