export type Row = Record<string, any>
export type Role = 'admin' | 'employee'
export type Field = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'boolean' | 'email' | 'multiline'; required?: boolean; min?: number; max?: number; integer?: boolean; default?: string | number | boolean; choices?: string[]; lookup?: string; admin?: boolean; section?: string; createOnly?: boolean }
export type Module = { id: string; title: string; singular: string; endpoint: string; post?: string; icon: string; group: 'finance' | 'people' | 'schedule' | 'flow'; admin?: boolean; create?: boolean; edit?: boolean; employeeWrite?: boolean; deleteLabel?: string; fields: Field[]; listKey?: string; detail?: boolean; hint?: string }
const f = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, label, ...extra })
const text = (key: string, label: string, required = false) => f(key, label, { required })
const number = (key: string, label: string, min = 0, value = 0): Field => f(key, label, { type: 'number', min, default: value, required: true })
const select = (key: string, label: string, choices: string[], value = choices[0]): Field => f(key, label, { type: 'select', choices, default: value, required: true })
const date = (key: string, label: string, required = true, time = false): Field => f(key, label, { type: time ? 'datetime' : 'date', required })
const lookup = (key: string, label: string, endpoint: string, required = false): Field => f(key, label, { type: 'select', lookup: endpoint, required })
const notes = f('notes', 'Notes', { type: 'multiline' })
const employee = { ...lookup('employeeId', 'Employee', '/employees', true), admin: true }
const priority = select('priority', 'Priority', ['standard', 'urgent', 'informational'])
const currencies = ['INR', 'USD', 'EUR']
export const modules: Module[] = [
  { id: 'expenses', title: 'Expenses', singular: 'Expense', endpoint: '/expenses', icon: 'receipt-outline', group: 'finance', admin: true, create: true, edit: true, detail: true, deleteLabel: 'Delete expense', listKey: 'expenses', fields: [text('description', 'What was this for?', true), number('totalAmount', 'Total amount including GST', .01), select('originalCurrency', 'Currency', currencies), number('exchangeRate', 'INR exchange rate', .000001, 1), { ...number('gstRate', 'GST (%)'), max: 100 }, lookup('categoryId', 'Category', '/categories', true), lookup('vendorId', 'Vendor', '/vendors'), date('expenseDate', 'Expense date'), select('expenseType', 'Expense type', ['one_time', 'recurring', 'salary', 'reimbursement', 'capex', 'opex']), text('invoiceNumber', 'Invoice number'), text('businessPurpose', 'Business purpose'), f('taxDeductible', 'Tax deductible', { type: 'boolean' }), select('gstInputCredit', 'GST input credit', ['unknown', 'yes', 'no']), { ...lookup('projectId', 'Project', '/projects'), createOnly: true }, { ...text('paidBy', 'Paid by'), createOnly: true }, { ...select('frequency', 'Repeat every', ['monthly', 'quarterly', 'yearly']), createOnly: true }, { ...date('nextDueDate', 'First due date', false), createOnly: true }, { ...notes, createOnly: true }] },
  { id: 'deposits', title: 'Deposits', singular: 'Deposit', endpoint: '/deposits', icon: 'arrow-down-circle-outline', group: 'finance', admin: true, create: true, edit: true, listKey: 'deposits', hint: 'Showing the latest 250 received deposits. Totals include all matching deposits.', fields: [text('source', 'Received from', true), number('originalAmount', 'Amount received', .01), select('originalCurrency', 'Currency', currencies), number('exchangeRate', 'INR exchange rate', .000001, 1), date('depositDate', 'Received date'), text('description', 'Description'), text('referenceNumber', 'Transaction reference'), text('paymentMethod', 'Payment method')] },
  { id: 'vendors', title: 'Vendors', singular: 'Vendor', endpoint: '/vendors', icon: 'storefront-outline', group: 'finance', admin: true, create: true, edit: true, detail: true, deleteLabel: 'Archive vendor', fields: [text('name', 'Vendor name', true), select('type', 'Vendor type', ['service', 'software', 'cloud', 'hardware', 'other']), text('contactName', 'Contact name'), f('email', 'Email', { type: 'email' }), text('phone', 'Phone'), text('website', 'Website'), text('gstin', 'GSTIN'), text('pan', 'PAN'), f('country', 'Country', { default: 'India' }), select('currency', 'Currency', currencies), text('address', 'Address'), text('city', 'City'), text('state', 'State'), text('postalCode', 'Postal code'), notes] },
  { id: 'subscriptions', title: 'Subscriptions', singular: 'Subscription', endpoint: '/subscriptions', icon: 'repeat-outline', group: 'finance', create: true, edit: true, detail: true, deleteLabel: 'Cancel subscription', fields: [text('productName', 'Service name', true), number('cost', 'Cost per billing cycle', .01), select('currency', 'Currency', currencies), select('billingCycle', 'Billing cycle', ['monthly', 'quarterly', 'half_yearly', 'yearly']), lookup('categoryId', 'Category', '/categories', true), lookup('vendorId', 'Vendor', '/vendors'), date('startDate', 'Start date'), date('nextBillingDate', 'Next billing date', false), f('autoRenewal', 'Automatic renewal', { type: 'boolean', default: true }), text('owner', 'Owner'), text('businessPurpose', 'Business purpose'), notes] },
  { id: 'employees', title: 'Directory', singular: 'Employee', endpoint: '/employees', icon: 'people-outline', group: 'people', create: true, edit: true, deleteLabel: 'Archive employee', fields: [text('name', 'Full name', true), f('email', 'Work email', { type: 'email', required: true }), text('phone', 'Phone'), text('role', 'Job title'), text('department', 'Department'), text('managerName', 'Manager'), text('workLocation', 'Work location'), select('employmentType', 'Employment type', ['full_time', 'part_time', 'contractor', 'freelancer', 'intern']), { ...number('monthlyCost', 'Monthly compensation'), admin: true }, { ...number('annualPtoDays', 'Annual paid leave days', 0, 18), admin: true }, date('startDate', 'Start date', false), select('status', 'Status', ['active', 'on_leave', 'terminated', 'contractor']), notes] },
  { id: 'leave', title: 'Leave requests', singular: 'Leave request', endpoint: '/employees/leave', icon: 'leaf-outline', group: 'people', create: true, employeeWrite: true, fields: [employee, select('leaveType', 'Leave type', ['paid_time_off', 'sick', 'unpaid', 'parental', 'comp_off']), date('startDate', 'First day'), date('endDate', 'Last day'), number('days', 'Working days requested', .5, 1), f('reason', 'Reason', { type: 'multiline', required: true })] },
  { id: 'attendance', title: 'Attendance', singular: 'Attendance entry', endpoint: '/employees/attendance', icon: 'finger-print-outline', group: 'people', create: true, employeeWrite: true, hint: 'Saving replaces the attendance entry for this employee and date.', fields: [employee, date('workDate', 'Work date'), date('checkIn', 'Check-in time', false, true), date('checkOut', 'Check-out time', false, true), select('workMode', 'Work mode', ['office', 'remote', 'hybrid', 'field']), select('status', 'Status', ['present', 'absent', 'leave', 'holiday', 'lwop']), { ...number('regularHours', 'Regular hours', 0, 8), max: 24 }, { ...number('overtimeHours', 'Overtime hours'), max: 24 }, notes] },
  { id: 'balances', title: 'Leave balances', singular: 'Leave balance', endpoint: '/employees/leave/balances', icon: 'pie-chart-outline', group: 'people', fields: [] },
  { id: 'payslips', title: 'Payslips', singular: 'Payslip', endpoint: '/employees/payslips', icon: 'document-text-outline', group: 'people', fields: [] },
  { id: 'payroll', title: 'Payroll', singular: 'Payroll batch', endpoint: '/employees/payroll-batches', icon: 'card-outline', group: 'people', admin: true, create: true, detail: true, hint: 'Creating a batch calculates payroll for all active employees and creates or updates its salary expense.', fields: [date('periodStart', 'Period starts'), date('periodEnd', 'Period ends'), number('bonuses', 'Total bonuses'), number('deductions', 'Total deductions'), select('status', 'Status', ['draft', 'approved', 'paid']), notes] },
  { id: 'notifications', title: 'Admin notifications', singular: 'Notification', endpoint: '/employees/notifications', icon: 'notifications-outline', group: 'people', admin: true, fields: [text('title', 'Notification'), text('message', 'Details'), text('employeeName', 'Employee'), text('type', 'Type'), text('status', 'Status'), date('occurredAt', 'Time', false, true)] },
  { id: 'taskboard', title: 'Taskboard', singular: 'Task', endpoint: '/employees/lifecycle', icon: 'checkbox-outline', group: 'people', admin: true, create: true, fields: [text('title', 'Task', true), { ...employee, required: false }, select('taskType', 'Task type', ['general', 'onboarding', 'offboarding']), f('ownerTeam', 'Owner team', { default: 'Operations' }), date('dueDate', 'Due date', false), f('checklist', 'Checklist', { type: 'multiline' })] },
  { id: 'events', title: 'Events', singular: 'Event', endpoint: '/schedule/events', icon: 'calendar-outline', group: 'schedule', create: true, employeeWrite: true, fields: [text('title', 'Event title', true), date('startsAt', 'Starts', true, true), date('endsAt', 'Ends', true, true), select('eventType', 'Event type', ['meeting', 'availability', 'holiday', 'deadline', 'audit', 'tax', 'launch', 'personal']), priority, text('participantsFrom', 'Meeting from'), text('participantsTo', 'Meeting with'), f('purpose', 'Meeting purpose', { type: 'multiline' }), f('outcome', 'Meeting result', { type: 'multiline' }), text('location', 'Location'), text('ownerName', 'Organizer'), lookup('projectId', 'Project', '/projects'), f('description', 'Description', { type: 'multiline' }), f('isAllDay', 'All-day event', { type: 'boolean' })] },
  { id: 'milestones', title: 'Milestones', singular: 'Milestone', endpoint: '/schedule/milestones', icon: 'flag-outline', group: 'schedule', create: true, employeeWrite: true, fields: [text('title', 'Milestone', true), date('dueAt', 'Due date', true, true), priority, lookup('projectId', 'Project', '/projects'), text('ownerDepartment', 'Owner department'), notes] },
  { id: 'automation', title: 'Automation', singular: 'Automation rule', endpoint: '/flow/automation-rules', icon: 'flash-outline', group: 'flow', admin: true, create: true, hint: 'Rules are saved configurations. Active does not mean a rule has executed.', fields: [text('name', 'Rule name', true), select('triggerModule', 'Trigger module', ['ledger', 'people', 'schedule', 'flow']), text('triggerEvent', 'Trigger event', true), select('actionModule', 'Action module', ['schedule', 'people', 'ledger', 'flow']), f('actionSummary', 'Action', { type: 'multiline', required: true }), priority, notes] },
  { id: 'insights', title: 'Insights', singular: 'Insight', endpoint: '/flow/insights', icon: 'bulb-outline', group: 'flow', admin: true, create: true, fields: [text('title', 'Title', true), select('severity', 'Severity', ['standard', 'urgent', 'informational']), select('sourceModule', 'Source', ['flow', 'ledger', 'people', 'schedule']), f('rootCause', 'Observation', { type: 'multiline', required: true }), f('recommendedAction', 'Recommended action', { type: 'multiline', required: true })] },
  { id: 'forecast', title: 'Forecast scenarios', singular: 'Scenario', endpoint: '/flow/forecast', post: '/flow/forecast-scenarios', icon: 'trending-up-outline', group: 'flow', admin: true, create: true, listKey: 'scenarios', hint: 'Scenarios are simple projections from your assumptions, not trained predictions.', fields: [text('name', 'Scenario name', true), { ...number('horizonMonths', 'Months ahead', 1, 6), max: 36, integer: true }, number('assumedMonthlyRevenue', 'Monthly revenue'), number('assumedMonthlyBurn', 'Monthly spending'), { ...number('plannedHeadcountChange', 'Headcount change', -100000), integer: true }, select('confidence', 'Confidence', ['low', 'medium', 'high']), notes] },
]
export const settingsFields: Field[] = [f('companyName', 'Company name', { required: true, section: 'Company' }), f('country', 'Country', { default: 'India' }), text('gstin', 'GSTIN'), text('pan', 'PAN'), { ...select('baseCurrency', 'Base currency', [...currencies, 'GBP']), section: 'Reporting' }, select('reportingYear', 'Reporting year', ['calendar', 'financial']), f('autoBackup', 'Automatic backups', { type: 'boolean', section: 'Data' }), number('autoBackupInterval', 'Backup interval (hours)', 1, 24), f('backupPath', 'Backup directory', { default: './backups' })]
export const moduleById = (id: string) => { const module = modules.find(item => item.id === id); if (!module) throw new Error('Unknown module'); return module }
export const allowedModule = (id: string, role: Role) => { const module = modules.find(item => item.id === id); return Boolean(module && (!module.admin || role === 'admin')) }
export const canWrite = (module: Module, role: Role) => role === 'admin' || Boolean(module.employeeWrite)
export const human = (value: unknown) => String(value ?? '').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
export const dateKey = (value: Date = new Date()) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
export function initialValues(fields: Field[], row: Row = {}) {
  return Object.fromEntries(fields.map(field => {
    let value = row[field.key] ?? field.default ?? ''
    if (field.type === 'boolean') value = Boolean(value)
    else if (field.type === 'date' && value) value = dateKey(new Date(String(value)))
    else if ((field.type === 'date' || field.type === 'datetime') && field.required && !value) value = field.type === 'date' ? dateKey() : new Date().toISOString()
    else value = String(value)
    return [field.key, value]
  }))
}
export function formPayload(fields: Field[], values: Row, role: Role): Row {
  const data: Row = {}
  for (const field of fields.filter(item => !item.admin || role === 'admin')) {
    const raw = field.key === 'exchangeRate' && values.originalCurrency === 'INR' ? 1 : values[field.key]
    const value = typeof raw === 'string' ? raw.trim() : raw
    if (field.required && (value === '' || value === undefined || value === null)) throw new Error(`${field.label} is required.`)
    if (field.type === 'boolean') { data[field.key] = Boolean(value); continue }
    if (value === '' || value === null || value === undefined) { data[field.key] = null; continue }
    if (field.type === 'number' || field.lookup) {
      const num = Number(value)
      if (!Number.isFinite(num) || (field.min !== undefined && num < field.min) || (field.max !== undefined && num > field.max) || ((field.integer || field.lookup) && !Number.isInteger(num)) || (field.lookup && num <= 0)) throw new Error(`Enter a valid ${field.label.toLowerCase()}${field.min !== undefined ? ` (minimum ${field.min})` : ''}.`)
      data[field.key] = num
    } else if (field.type === 'date' || field.type === 'datetime') {
      const parsed = new Date(field.type === 'date' ? `${value}T12:00:00` : String(value))
      if (!Number.isFinite(parsed.getTime())) throw new Error(`Choose a valid ${field.label.toLowerCase()}.`)
      if (field.type === 'date' && dateKey(parsed) !== value) throw new Error(`Choose a valid ${field.label.toLowerCase()}.`)
      data[field.key] = parsed.toISOString()
    } else {
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) throw new Error('Enter a valid email address.')
      if (field.choices && !field.choices.includes(String(value))) throw new Error(`Choose a valid ${field.label.toLowerCase()}.`)
      data[field.key] = field.type === 'email' ? String(value).toLowerCase() : value
    }
  }
  for (const [start, end] of [['startDate', 'endDate'], ['periodStart', 'periodEnd'], ['startsAt', 'endsAt'], ['checkIn', 'checkOut']]) {
    if (data[start] && data[end] && data[start] > data[end]) throw new Error('The end must be on or after the start.')
  }
  if (data.originalCurrency === 'INR') data.exchangeRate = 1
  if (data.regularHours !== undefined && data.regularHours + (data.overtimeHours || 0) > 24) throw new Error('Total work hours cannot exceed 24.')
  if (data.days && data.startDate && data.endDate && data.days > Math.round((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / 86400000) + 1) throw new Error('Requested working days cannot exceed the selected date range.')
  return data
}
export function recordTitle(id: string, row: Row) {
  if (['leave', 'attendance', 'payslips'].includes(id)) return row.employee?.name || row.slipId || human(id)
  return row.description && id === 'expenses' ? row.description : row.source || row.productName || row.name || row.title || row.batchId || 'Record'
}
export function recordSubtitle(id: string, row: Row) {
  if (id === 'employees') return [row.role, row.department].filter(Boolean).join(' · ')
  if (id === 'leave') return `${human(row.leaveType)} · ${row.days} days`
  if (id === 'attendance') return `${human(row.workMode)} · ${row.regularHours} hours`
  if (id === 'balances') return `${row.balance} days available · ${row.used} used`
  return [row.vendor?.name || row.employee?.name || row.ownerDepartment || row.email, row.category?.name || row.project?.name || row.billingCycle].filter(Boolean).map(human).join(' · ')
}
export function recordAmount(row: Row): number | null {
  const value = row.baseCurrencyAmount ?? row.netPay ?? row.cost ?? row.projectedNetBurn
  return value === undefined || value === null ? null : Number(value)
}
export function recordDate(row: Row): string | undefined { return row.expenseDate || row.depositDate || row.nextBillingDate || row.workDate || row.startsAt || row.dueAt || row.dueDate || row.periodStart || row.startDate || row.occurredAt }
export function sourceRoute(href: string): { module: string; query: string } | null {
  try { if (!href.startsWith('/') || href.startsWith('//')) return null; const url = new URL(href, 'https://workspace.local'); const module = modules.find(item => item.endpoint === url.pathname); return module ? { module: module.id, query: url.search.slice(1) } : null } catch { return null }
}
