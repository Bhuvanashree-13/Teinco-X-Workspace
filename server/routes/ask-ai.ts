import { Router } from 'express'
import { z } from 'zod'
import { startOfMonth, startOfYear, subMonths, endOfMonth, startOfDay, endOfDay, addDays } from 'date-fns'
import { prisma } from '../db.js'
import { categoryBreakdownFor } from '../lib/dashboard-categories.js'
import { vendorBreakdownFor } from '../lib/analytics-vendors.js'
import { answerWithGemini, geminiConfiguration, type AskContext, type AskFact } from '../lib/ask-ai.js'
import { buildVyomReadPlan, type VyomReadPlan } from '../lib/vyom-read-plan.js'
import type { AuthedRequest } from '../middleware/auth.js'
import { ensureMonthlyLeaveLimit } from './employees.js'
const router = Router()
const periodSchema = z.enum(['month', 'last_month', 'year'])
const historySchema = z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) }).strict()).max(12).default([])
const requestSchema = z.object({ question: z.string().trim().min(3).max(1000), period: periodSchema, history: historySchema.optional(), conversationId: z.number().int().positive().optional() }).strict()
const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)
const featureFacts: AskFact[] = [
  { id: 'feature-dashboard', text: 'Dashboard summarizes the administrator workspace; it is for monitoring, not editing source records.', source: { label: 'Dashboard', href: '/' } },
  { id: 'feature-expenses', text: 'Expenses is the source ledger for spending, tax, currency, payment, vendor, category, project, recurrence, invoice, and attachment details.', source: { label: 'Expenses', href: '/expenses' } },
  { id: 'feature-deposits', text: 'Deposits records received income and reversals; period net is received deposits minus active expenses, not a bank balance.', source: { label: 'Deposits', href: '/deposits' } },
  { id: 'feature-vendors', text: 'Vendors manages supplier profiles and their linked expenses, subscriptions, and assets. Contact and tax identifiers are not exposed to Vyom.', source: { label: 'Vendors', href: '/vendors' } },
  { id: 'feature-subscriptions', text: 'Subscriptions tracks recurring products, billing cycles, renewal dates, next billing dates, ownership, and renewal status.', source: { label: 'Subscriptions', href: '/subscriptions' } },
  { id: 'feature-assets', text: 'Assets tracks equipment lifecycle, assignment, warranty, location, and status. Serial numbers are not exposed to Vyom.', source: { label: 'Assets', href: '/assets' } },
  { id: 'feature-people', text: 'People covers the employee directory, attendance, leave, lifecycle, and payroll. Vyom receives operational counts only, not contact, compensation, payroll, or private leave details.', source: { label: 'People', href: '/people' } },
  { id: 'feature-projects', text: 'Projects and Taskboard organize delivery work by project, status, priority, assignee, sprint, due date, and milestones.', source: { label: 'Projects & Taskboard', href: '/projects' } },
  { id: 'feature-schedule', text: 'Schedule tracks events, meetings, deadlines, holidays, launches, audits, tax dates, and project milestones.', source: { label: 'Schedule', href: '/schedule' } },
  { id: 'feature-analytics', text: 'Analytics provides sourced spend views by category, vendor, project, and time period.', source: { label: 'Analytics', href: '/analytics' } },
  { id: 'feature-flow', text: 'Flow contains evidence checks, insights, automation-rule definitions, forecasts, and Vyom. A suggestion or enabled rule is not authorization for Vyom to change a record.', source: { label: 'Flow', href: '/flow' } },
  { id: 'feature-access', text: 'Vyom and sensitive finance, analytics, Flow, and settings views are restricted to authenticated administrators. Authorization is enforced by the server, and Vyom is read-only.', source: { label: 'Access settings', href: '/settings' } },
]
type DateRange = { start: Date; end: Date; label: string }
const contextCache = new Map<string, { expiresAt: number; context: AskContext }>()
const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
export function questionDateRange(question: string, now = new Date()): DateRange | null {
  const normalized = question.toLowerCase()
  const monthPattern = new RegExp(`\\b(${monthNames.join('|')})\\b(?:\\s+(?:month\\s+)?(20\\d{2}))?`, 'i')
  const match = normalized.match(monthPattern)
  if (match) {
    const month = monthNames.indexOf(match[1].toLowerCase())
    const year = match[2] ? Number(match[2]) : month <= now.getMonth() ? now.getFullYear() : now.getFullYear() - 1
    const start = new Date(year, month, 1), end = endOfMonth(start)
    return { start, end, label: `${monthNames[month][0].toUpperCase()}${monthNames[month].slice(1)} ${year}` }
  }
  if (/\blast month\b/i.test(question)) {
    const start = startOfMonth(subMonths(now, 1))
    return { start, end: endOfMonth(start), label: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
  }
  return null
}
function contextCacheMs() {
  const value = Number(process.env.VYOM_CONTEXT_CACHE_MS)
  return Number.isFinite(value) && value >= 30000 && value <= 300000 ? Math.trunc(value) : 120000
}

export async function retrieveAskContext(period: z.infer<typeof periodSchema>, requestedRange?: DateRange | null): Promise<AskContext> {
  const now = new Date()
  const start = requestedRange?.start || (period === 'year' ? startOfYear(now) : startOfMonth(period === 'last_month' ? subMonths(now, 1) : now))
  const end = requestedRange?.end || (period === 'last_month' ? endOfMonth(subMonths(now, 1)) : now)
  const where = { status: 'active', expenseDate: { gte: start, lte: end } }
  const range = `startDate=${encodeURIComponent(start.toISOString())}&endDate=${encodeURIComponent(end.toISOString())}`
  const [total, deposits, categorySpend, categories, vendorSpend, vendors, largest, expenseDetails] = await prisma.$transaction(async db => Promise.all([
    db.expense.aggregate({ where, _sum: { baseCurrencyAmount: true }, _count: true }),
    db.deposit.aggregate({ where: { status: 'received', depositDate: { gte: start, lte: end } }, _sum: { baseCurrencyAmount: true }, _count: true }),
    db.expense.groupBy({ by: ['categoryId'], where, _sum: { baseCurrencyAmount: true } }),
    db.expenseCategory.findMany(),
    db.expense.groupBy({ by: ['vendorId', 'expenseType'], where, _sum: { baseCurrencyAmount: true }, _count: true }),
    db.vendor.findMany({ select: { id: true, name: true } }),
    db.expense.findMany({ where, orderBy: [{ baseCurrencyAmount: 'desc' }, { id: 'asc' }], take: 10, select: { expenseId: true, baseCurrencyAmount: true, expenseDate: true } }),
    db.expense.findMany({ where, orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }], take: 250, select: { id: true, expenseId: true, description: true, baseCurrencyAmount: true, expenseDate: true, expenseType: true, vendor: { select: { name: true } }, category: { select: { name: true } }, project: { select: { name: true } } } }),
  ]))
  const todayStart = startOfDay(now), todayEnd = endOfDay(now), upcomingEnd = addDays(now, 30)
  const [activeEmployees, pendingLeave, attendanceToday, openTasks, blockedTasks, workItemsForContext, upcomingEvents, openMilestones, urgentInsights, activeSubscriptions] = await prisma.$transaction(async db => Promise.all([
    db.employee.count({ where: { isArchived: false, status: { in: ['active', 'on_leave', 'contractor'] } } }),
    db.leaveRequest.count({ where: { status: 'pending' } }),
    db.attendanceLog.count({ where: { workDate: { gte: todayStart, lte: todayEnd } } }),
    db.workItem.count({ where: { status: { not: 'done' } } }),
    db.workItem.count({ where: { status: 'blocked' } }),
    db.workItem.findMany({ where: { status: { not: 'done' } }, orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }], take: 30, include: { project: { select: { name: true } }, assignee: { select: { name: true } } } }),
    db.scheduleEvent.findMany({ where: { status: 'scheduled', startsAt: { gte: now, lte: upcomingEnd } }, orderBy: { startsAt: 'asc' }, take: 5, select: { eventId: true, title: true, startsAt: true, participantsFrom: true, participantsTo: true, purpose: true } }),
    db.scheduleMilestone.count({ where: { status: 'open', dueAt: { gte: now, lte: upcomingEnd } } }),
    db.executiveInsight.count({ where: { status: 'open', severity: 'urgent' } }),
    db.subscription.count({ where: { isArchived: false, status: { in: ['active', 'trial'] } } }),
  ]))
  const source = { label: 'Expense records in this period', href: `/expenses?${range}` }
  const spend = Number(total._sum.baseCurrencyAmount) || 0
  const received = Number(deposits._sum.baseCurrencyAmount) || 0
  const facts: AskFact[] = [
    { id: 'spend-total', text: `Recorded spending is ${money(spend)} across ${total._count} active expenses in the selected period.`, amount: spend, count: total._count, source },
    { id: 'deposit-total', text: `Received deposits total ${money(received)} across ${deposits._count} deposits in the selected period.`, amount: received, count: deposits._count, source: { label: 'Received deposits in this period', href: `/deposits?${range}` } },
    { id: 'period-net', text: `Received deposits minus recorded expenses for this period is ${money(received - spend)}. This is a period movement, not a bank balance.`, amount: received - spend, source },
    { id: 'people-active', text: `${activeEmployees} employees and contractors are currently active in People.`, count: activeEmployees, source: { label: 'People', href: '/people' } },
    { id: 'leave-pending', text: `${pendingLeave} leave requests are waiting for admin review.`, count: pendingLeave, source: { label: 'Leave requests', href: '/people' } },
    { id: 'attendance-today', text: `Attendance has been recorded for ${attendanceToday} people today out of ${activeEmployees} active people.`, count: attendanceToday, source: { label: 'Attendance', href: '/people' } },
    { id: 'tasks-open', text: `${openTasks} project work items are open across the Taskboard workflow.`, count: openTasks, source: { label: 'Projects & Taskboard', href: '/projects' } },
    { id: 'tasks-blocked', text: `${blockedTasks} project work items are currently blocked.`, count: blockedTasks, source: { label: 'Projects & Taskboard', href: '/projects' } },
    { id: 'milestones-upcoming', text: `${openMilestones} open milestones are due within the next 30 days.`, count: openMilestones, source: { label: 'Schedule milestones', href: '/schedule' } },
    { id: 'insights-urgent', text: `${urgentInsights} urgent workspace insights are open.`, count: urgentInsights, source: { label: 'Flow insights', href: '/flow' } },
    { id: 'subscriptions-active', text: `${activeSubscriptions} subscriptions are active or in trial.`, count: activeSubscriptions, source: { label: 'Subscriptions', href: '/subscriptions' } },
    ...featureFacts,
  ]
  for (const task of workItemsForContext) facts.push({ id: `task-${task.id}`, text: `Task ${task.key}: ${task.summary} · project ${task.project.name} · status ${task.status} · priority ${task.priority}${task.assignee?.name ? ` · assigned to ${task.assignee.name}` : ' · unassigned'}${task.dueDate ? ` · due ${task.dueDate.toISOString().slice(0, 10)}` : ''}.`, source: { label: task.key, href: '/projects' } })
  for (const [index, event] of upcomingEvents.entries()) {
    const between = event.participantsFrom || event.participantsTo ? ` Between ${event.participantsFrom || 'unspecified'} and ${event.participantsTo || 'unspecified'}.` : ''
    const purpose = event.purpose ? ` Purpose: ${event.purpose.slice(0, 180)}.` : ''
    facts.push({ id: `event-${index}`, text: `Upcoming meeting: ${event.title.slice(0, 140)} on ${event.startsAt.toISOString()}.${between}${purpose}`, source: { label: event.eventId, href: '/schedule' } })
  }
  const categoryRows = categoryBreakdownFor(categorySpend, categories)
  for (const [index, row] of categoryRows.slice(0, 20).entries()) facts.push({ id: `category-${index}`, text: `Category rank ${index + 1}: ${row.category.slice(0, 120)} — ${money(row.amount)}, including subcategories.`, amount: row.amount, source })
  const vendorRows = vendorBreakdownFor(vendorSpend, vendors)
  for (const [index, row] of vendorRows.filter(row => row.kind === 'vendor').slice(0, 20).entries()) facts.push({ id: `vendor-${index}`, text: `Vendor rank ${index + 1}: ${row.vendor.slice(0, 120)} — ${money(row.amount)} across ${row.transactions} expenses.`, amount: row.amount, count: row.transactions, source })
  for (const row of vendorRows.filter(row => row.kind !== 'vendor')) facts.push({ id: row.key, text: `${row.vendor}: ${money(row.amount)} across ${row.transactions} expenses; excluded from vendor rankings.`, amount: row.amount, count: row.transactions, source })
  for (const [index, row] of largest.entries()) facts.push({ id: `expense-${index}`, text: `Expense rank ${index + 1}: ${row.expenseId}, ${money(Number(row.baseCurrencyAmount))}, dated ${row.expenseDate.toISOString().slice(0, 10)}.`, amount: Number(row.baseCurrencyAmount), source: { label: row.expenseId, href: `/expenses?search=${encodeURIComponent(row.expenseId)}` } })
  for (const row of expenseDetails) {
    const searchable = [row.vendor?.name, row.description, row.category?.name, row.project?.name, row.expenseType].filter(Boolean).join(' · ')
    facts.push({ id: `expense-detail-${row.id}`, text: `Expense ${row.expenseId}: ${String(row.description || 'No description').slice(0, 180)} · ${row.vendor?.name || 'No vendor'} · ${row.category?.name || 'Uncategorised'}${row.project?.name ? ` · project ${row.project.name}` : ''} · ${money(Number(row.baseCurrencyAmount))} · ${row.expenseDate.toISOString().slice(0, 10)} · ${searchable.slice(0, 240)}.`, amount: Number(row.baseCurrencyAmount), source: { label: row.expenseId, href: `/expenses?search=${encodeURIComponent(row.expenseId)}` } })
  }
  return { period: requestedRange?.label || period, start: start.toISOString(), end: end.toISOString(), retrievedAt: now.toISOString(), facts, coverage: [`Finance facts cover ${requestedRange?.label || 'the selected reporting period'}. People and attendance facts reflect the current workspace; schedule facts cover the next 30 days.`, `The context includes ${expenseDetails.length} of ${total._count} expense rows, up to 20 categories, 20 vendors, the 10 largest expenses, and ${workItemsForContext.length} of ${openTasks} open tasks.`, 'Vyom can continue a conversation using the last 12 messages. Workspace claims remain tied to verified facts; general-knowledge answers are labeled separately.'] }
}
async function cachedAskContext(period: z.infer<typeof periodSchema>, range?: DateRange | null) {
  const key = range ? `${range.start.toISOString()}:${range.end.toISOString()}` : period
  const cached = contextCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.context
  const context = await retrieveAskContext(period, range)
  contextCache.set(key, { expiresAt: Date.now() + contextCacheMs(), context })
  return context
}
function minimalAskContext(period: z.infer<typeof periodSchema>, range?: DateRange | null): AskContext {
  const now = new Date()
  const start = range?.start || (period === 'year' ? startOfYear(now) : startOfMonth(period === 'last_month' ? subMonths(now, 1) : now))
  const end = range?.end || (period === 'last_month' ? endOfMonth(subMonths(now, 1)) : now)
  return { period: range?.label || period, start: start.toISOString(), end: end.toISOString(), retrievedAt: now.toISOString(), facts: featureFacts, coverage: ['No workspace records were retrieved because this question did not require them.'] }
}
async function addAllowlistedReadFacts(plan: VyomReadPlan, context: AskContext): Promise<AskContext> {
  if (plan.sensitiveRequested) return context
  const asks = (dataset: VyomReadPlan['datasets'][number]) => plan.datasets.includes(dataset)
  const facts: AskFact[] = []
  const { filters } = plan, limit = filters.limit
  if (asks('assets')) {
    const rows = await prisma.asset.findMany({ where: { isArchived: false, ...(filters.status ? { status: filters.status } : {}), ...(filters.minAmount != null || filters.maxAmount != null ? { purchaseCost: { ...(filters.minAmount != null ? { gte: filters.minAmount } : {}), ...(filters.maxAmount != null ? { lte: filters.maxAmount } : {}) } } : {}) }, orderBy: [{ status: 'asc' }, { name: 'asc' }], take: limit, select: { id: true, assetId: true, name: true, assetType: true, purchaseDate: true, purchaseCost: true, warrantyEnd: true, assignedTo: true, location: true, status: true, vendor: { select: { name: true } } } })
    for (const row of rows) facts.push({ id: `asset-record-${row.id}`, text: `Asset ${row.assetId}: ${row.name} · type ${row.assetType} · status ${row.status}${row.assignedTo ? ` · assigned to ${row.assignedTo}` : ''}${row.location ? ` · location ${row.location}` : ''}${row.vendor?.name ? ` · vendor ${row.vendor.name}` : ''}${row.purchaseDate ? ` · purchased ${row.purchaseDate.toISOString().slice(0, 10)}` : ''}${row.warrantyEnd ? ` · warranty ends ${row.warrantyEnd.toISOString().slice(0, 10)}` : ''} · recorded cost ${money(Number(row.purchaseCost))}.`, amount: Number(row.purchaseCost), source: { label: row.assetId, href: '/assets' } })
  }
  if (asks('subscriptions')) {
    const rows = await prisma.subscription.findMany({ where: { isArchived: false, ...(filters.status ? { status: filters.status } : {}), ...(filters.vendor ? { vendor: { is: { name: { contains: filters.vendor } } } } : {}), ...(filters.minAmount != null || filters.maxAmount != null ? { cost: { ...(filters.minAmount != null ? { gte: filters.minAmount } : {}), ...(filters.maxAmount != null ? { lte: filters.maxAmount } : {}) } } : {}) }, orderBy: [{ nextBillingDate: 'asc' }, { id: 'asc' }], take: limit, select: { id: true, subscriptionId: true, productName: true, cost: true, currency: true, billingCycle: true, renewalDate: true, nextBillingDate: true, autoRenewal: true, owner: true, businessPurpose: true, status: true, vendor: { select: { name: true } }, category: { select: { name: true } } } })
    for (const row of rows) facts.push({ id: `subscription-record-${row.id}`, text: `Subscription ${row.subscriptionId}: ${row.productName}${row.vendor?.name ? ` · vendor ${row.vendor.name}` : ''}${row.category?.name ? ` · category ${row.category.name}` : ''} · ${row.currency} ${Number(row.cost).toFixed(2)} ${row.billingCycle} · status ${row.status} · auto-renewal ${row.autoRenewal ? 'on' : 'off'}${row.nextBillingDate ? ` · next billing ${row.nextBillingDate.toISOString().slice(0, 10)}` : ''}${row.renewalDate ? ` · renewal ${row.renewalDate.toISOString().slice(0, 10)}` : ''}${row.owner ? ` · owner ${row.owner}` : ''}${row.businessPurpose ? ` · purpose ${row.businessPurpose.slice(0, 160)}` : ''}.`, source: { label: row.subscriptionId, href: '/subscriptions' } })
  }
  if (asks('projects')) {
    const rows = await prisma.project.findMany({ where: { status: filters.status || { not: 'archived' }, ...(filters.project ? { name: { contains: filters.project } } : {}), ...(filters.minAmount != null || filters.maxAmount != null ? { budget: { ...(filters.minAmount != null ? { gte: filters.minAmount } : {}), ...(filters.maxAmount != null ? { lte: filters.maxAmount } : {}) } } : {}) }, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }], take: limit, select: { id: true, code: true, name: true, description: true, status: true, startDate: true, endDate: true, budget: true, _count: { select: { workItems: true, milestones: true } } } })
    for (const row of rows) facts.push({ id: `project-record-${row.id}`, text: `Project ${row.code}: ${row.name} · status ${row.status} · ${row._count.workItems} tasks · ${row._count.milestones} milestones${row.startDate ? ` · starts ${row.startDate.toISOString().slice(0, 10)}` : ''}${row.endDate ? ` · ends ${row.endDate.toISOString().slice(0, 10)}` : ''}${row.budget != null ? ` · budget ${money(Number(row.budget))}` : ''}${row.description ? ` · ${row.description.slice(0, 180)}` : ''}.`, amount: row.budget == null ? undefined : Number(row.budget), source: { label: row.code, href: '/projects' } })
  }
  if (asks('people')) {
    const rows = await prisma.employee.findMany({ where: { isArchived: false, ...(filters.status ? { status: filters.status } : {}), ...(filters.assignee ? { name: { contains: filters.assignee } } : {}) }, orderBy: [{ department: 'asc' }, { name: 'asc' }], take: limit, select: { id: true, employeeId: true, name: true, role: true, department: true, managerName: true, workLocation: true, employmentType: true, status: true, startDate: true } })
    for (const row of rows) facts.push({ id: `people-record-${row.id}`, text: `Person ${row.employeeId}: ${row.name}${row.role ? ` · role ${row.role}` : ''}${row.department ? ` · department ${row.department}` : ''} · ${row.employmentType} · status ${row.status}${row.managerName ? ` · manager ${row.managerName}` : ''}${row.workLocation ? ` · location ${row.workLocation}` : ''}${row.startDate ? ` · started ${row.startDate.toISOString().slice(0, 10)}` : ''}.`, source: { label: row.employeeId, href: '/people' } })
    const leaves = await prisma.leaveRequest.findMany({ where: { status: filters.status || 'pending' }, orderBy: { startDate: 'asc' }, take: limit, select: { id: true, requestId: true, leaveType: true, startDate: true, endDate: true, days: true, status: true, blackoutChecked: true, employee: { select: { name: true, employeeId: true } } } })
    for (const row of leaves) facts.push({ id: `leave-record-${row.id}`, text: `Leave ${row.requestId}: ${row.employee.name} (${row.employee.employeeId}) · ${row.leaveType} · ${Number(row.days)} days · ${row.startDate.toISOString().slice(0, 10)} to ${row.endDate.toISOString().slice(0, 10)} · status ${row.status} · blackout check ${row.blackoutChecked ? 'complete' : 'not complete'}. Private reason is excluded.`, source: { label: row.requestId, href: '/people' } })
  }
  if (asks('vendors')) {
    const rows = await prisma.vendor.findMany({ orderBy: { name: 'asc' }, take: limit, select: { id: true, code: true, name: true, type: true, country: true, currency: true, isActive: true, _count: { select: { expenses: true, subscriptions: true, assets: true } } } })
    for (const row of rows) facts.push({ id: `vendor-record-${row.id}`, text: `Vendor ${row.code}: ${row.name} · type ${row.type} · ${row.isActive ? 'active' : 'inactive'} · country ${row.country} · currency ${row.currency} · ${row._count.expenses} expenses · ${row._count.subscriptions} subscriptions · ${row._count.assets} assets.`, source: { label: row.code, href: '/vendors' } })
  }
  if (asks('tasks')) {
    const rows = await prisma.workItem.findMany({ where: { ...(filters.status ? { status: filters.status } : {}), ...(filters.project ? { project: { name: { contains: filters.project } } } : {}), ...(filters.assignee ? { assignee: { name: { contains: filters.assignee } } } : {}), ...(filters.startDate || filters.endDate ? { dueDate: { ...(filters.startDate ? { gte: new Date(`${filters.startDate}T00:00:00.000Z`) } : {}), ...(filters.endDate ? { lte: new Date(`${filters.endDate}T23:59:59.999Z`) } : {}) } } : {}) }, orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }], take: limit, include: { project: { select: { name: true } }, assignee: { select: { name: true } } } })
    for (const row of rows) facts.push({ id: `task-query-${row.id}`, text: `Task ${row.key}: ${row.summary} · project ${row.project.name} · status ${row.status} · priority ${row.priority}${row.assignee?.name ? ` · assigned to ${row.assignee.name}` : ' · unassigned'}${row.sprint ? ` · sprint ${row.sprint}` : ''}${row.dueDate ? ` · due ${row.dueDate.toISOString().slice(0, 10)}` : ''}.`, source: { label: row.key, href: '/projects' } })
  }
  if (asks('automations')) {
    const rows = await prisma.flowAutomationRule.findMany({ where: { status: { not: 'archived' } }, orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }], take: limit, select: { id: true, ruleId: true, name: true, triggerModule: true, triggerEvent: true, actionModule: true, actionSummary: true, priority: true, status: true, lastRunAt: true } })
    for (const row of rows) facts.push({ id: `automation-record-${row.id}`, text: `Automation ${row.ruleId}: ${row.name} · ${row.triggerModule}/${row.triggerEvent} → ${row.actionModule}/${row.actionSummary} · priority ${row.priority} · status ${row.status}${row.lastRunAt ? ` · last ran ${row.lastRunAt.toISOString()}` : ''}. An active definition does not prove an action executed.`, source: { label: row.ruleId, href: '/flow' } })
  }
  return facts.length ? { ...context, facts: [...facts, ...context.facts], coverage: [`Structured read returned ${facts.length} approved records using server-validated filters (maximum ${limit} per requested module). Sensitive fields were excluded.`, ...context.coverage] } : context
}
export function explicitProposalIntent(question: string, action: string) {
  return action === 'create_task'
    ? /\b(create|add|open|make|draft|prepare)\b[\s\S]{0,50}\b(task|issue|work item)\b/i.test(question)
    : action === 'update_subscription'
      ? /\b(update|change|set|cancel|pause|resume|renew|edit|draft|prepare)\b[\s\S]{0,60}\b(subscription|renewal|billing)\b/i.test(question)
      : action === 'approve_leave'
        ? /\b(approve|accept|authorize|draft|prepare)\b[\s\S]{0,40}\bleave\b/i.test(question)
        : false
}
async function materializeProposal(userId: number, conversationId: number, question: string, proposal: any) {
  if (!proposal) return null
  if (!explicitProposalIntent(question, proposal.action)) return null
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  if (proposal.action === 'create_task') {
    const project = await prisma.project.findFirst({ where: { OR: [{ code: proposal.projectRef }, { name: proposal.projectRef }] }, select: { id: true, code: true, name: true } })
    if (!project) return null
    const assignee = proposal.assigneeRef ? await prisma.employee.findFirst({ where: { OR: [{ employeeId: proposal.assigneeRef }, { name: proposal.assigneeRef }] }, select: { id: true, employeeId: true, name: true } }) : null
    const payload = { projectId: project.id, project: { code: project.code, name: project.name }, summary: proposal.summary, description: proposal.description || null, priority: proposal.priority || 'medium', assigneeId: assignee?.id || null, assignee: assignee ? { employeeId: assignee.employeeId, name: assignee.name } : null, dueDate: proposal.dueDate || null }
    const existing = await prisma.vyomProposal.findFirst({ where: { createdById: userId, action: 'create_task', targetRef: project.code, status: 'pending', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } })
    if (existing && JSON.stringify(existing.payload) === JSON.stringify(payload)) return existing
    return prisma.vyomProposal.create({ data: { createdById: userId, conversationId, action: 'create_task', entityType: 'work_item', targetRef: project.code, payload, expiresAt } })
  }
  if (proposal.action === 'update_subscription') {
    const target = await prisma.subscription.findFirst({ where: { subscriptionId: proposal.targetRef }, select: { id: true, subscriptionId: true, productName: true, status: true, cost: true, nextBillingDate: true, autoRenewal: true, owner: true, businessPurpose: true, updatedAt: true } })
    if (!target || !Object.keys(proposal.changes || {}).length) return null
    const existing = await prisma.vyomProposal.findFirst({ where: { createdById: userId, action: 'update_subscription', targetId: target.id, status: 'pending', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } })
    if (existing && JSON.stringify(existing.payload) === JSON.stringify(proposal.changes)) return existing
    return prisma.vyomProposal.create({ data: { createdById: userId, conversationId, action: 'update_subscription', entityType: 'subscription', targetId: target.id, targetRef: target.subscriptionId, payload: proposal.changes, beforeValue: JSON.parse(JSON.stringify(target)), expiresAt } })
  }
  if (proposal.action === 'approve_leave') {
    const target = await prisma.leaveRequest.findFirst({ where: { requestId: proposal.targetRef, status: 'pending' }, select: { id: true, requestId: true, employeeId: true, leaveType: true, startDate: true, endDate: true, days: true, status: true, blackoutChecked: true, updatedAt: true, employee: { select: { name: true } } } })
    if (!target) return null
    const existing = await prisma.vyomProposal.findFirst({ where: { createdById: userId, action: 'approve_leave', targetId: target.id, status: 'pending', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } })
    if (existing) return existing
    return prisma.vyomProposal.create({ data: { createdById: userId, conversationId, action: 'approve_leave', entityType: 'leave_request', targetId: target.id, targetRef: target.requestId, payload: { status: 'approved' }, beforeValue: JSON.parse(JSON.stringify(target)), expiresAt } })
  }
  return null
}
const expenseQueryStopWords = new Set(['what', 'which', 'where', 'when', 'show', 'tell', 'give', 'get', 'find', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'we', 'our', 'for', 'on', 'to', 'of', 'in', 'how', 'much', 'total', 'amount', 'spend', 'spent', 'spending', 'expense', 'expenses', 'cost', 'costs', 'current', 'period', 'month', 'year'])
function addQuestionExpenseTotal(question: string, context: AskContext): AskContext {
  if (!/\b(total|amount|how much|spend|spent|spending|cost)\b/i.test(question)) return context
  const terms = (question.toLowerCase().match(/[a-z0-9]+/g) || []).filter(word => word.length > 2 && !expenseQueryStopWords.has(word) && !monthNames.includes(word))
  if (!terms.length) return context
  const matches = context.facts.filter(fact => fact.id.startsWith('expense-detail-') && terms.every(term => fact.text.toLowerCase().includes(term)))
  if (!matches.length) return context
  const amount = matches.reduce((sum, fact) => sum + Number(fact.amount || 0), 0)
  const source = { label: `Expenses matching ${terms.join(' ')}`, href: `/expenses?search=${encodeURIComponent(terms.join(' '))}&startDate=${encodeURIComponent(context.start)}&endDate=${encodeURIComponent(context.end)}` }
  return { ...context, facts: [{ id: 'query-expense-total', text: `Exact matching total for “${terms.join(' ')}” is ${money(amount)} across ${matches.length} expense${matches.length === 1 ? '' : 's'} from ${context.start.slice(0, 10)} through ${context.end.slice(0, 10)}.`, amount, count: matches.length, source }, ...context.facts] }
}
const csvCell = (value: unknown) => {
  let text = String(value ?? '')
  if (/^[=+@-]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
router.get('/expense-sheet', async (req, res) => {
  const parsed = z.object({ startDate: z.string().datetime(), endDate: z.string().datetime(), search: z.string().trim().max(100).optional() }).strict().safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid expense-sheet date range.' })
  const start = new Date(parsed.data.startDate), end = new Date(parsed.data.endDate)
  if (end < start || end.getTime() - start.getTime() > 366 * 86400000) return res.status(400).json({ error: 'Expense-sheet ranges must be one year or less.' })
  const search = parsed.data.search
  const where: any = { status: 'active', expenseDate: { gte: start, lte: end }, ...(search ? { OR: [{ expenseId: { contains: search } }, { description: { contains: search } }, { notes: { contains: search } }, { vendor: { is: { name: { contains: search } } } }] } : {}) }
  const rows = await prisma.expense.findMany({ where, orderBy: [{ expenseDate: 'asc' }, { id: 'asc' }], take: 10000, include: { vendor: { select: { name: true } }, category: { select: { name: true } }, project: { select: { name: true } }, paymentMethod: { select: { name: true } } } })
  const header = ['Expense ID', 'Date', 'Vendor', 'Description', 'Category', 'Project', 'Type', 'Currency', 'Original amount', 'GST', 'INR total', 'Payment method', 'Invoice number']
  const csv = [header, ...rows.map(row => [row.expenseId, row.expenseDate.toISOString().slice(0, 10), row.vendor?.name, row.description, row.category?.name, row.project?.name, row.expenseType, row.originalCurrency, Number(row.originalAmount), Number(row.gstAmount), Number(row.baseCurrencyAmount), row.paymentMethod?.name, row.invoiceNumber])].map(line => line.map(csvCell).join(',')).join('\r\n')
  const filename = `expenses-${start.toISOString().slice(0, 10)}-to-${end.toISOString().slice(0, 10)}.csv`
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(`\uFEFF${csv}`)
})
router.get('/config', (_req, res) => {
  const config = geminiConfiguration()
  res.set('Cache-Control', 'no-store')
  res.json({ enabled: Boolean(config), provider: 'Gemini', model: config?.model || null, readOnly: true })
})
router.post('/test', async (_req, res) => {
  const config = geminiConfiguration()
  if (!config) return res.status(503).json({ error: 'Set GEMINI_API_KEY on the app server, then restart it.' })
  try {
    const now = new Date().toISOString()
    const answer = await answerWithGemini('How much was spent in the selected period?', {
      period: 'month', start: now, end: now, retrievedAt: now, coverage: [],
      facts: [{ id: 'spend-total', text: 'Recorded spending is INR 100 in the selected period.', source: { label: 'Connection test', href: '/flow' } }],
    }, config)
    if (answer.status !== 'answered' || !answer.facts.length) throw new Error('Invalid answer')
    res.set('Cache-Control', 'no-store')
    res.json({ message: `Connected to ${config.model}. Verified answer test passed.` })
  } catch { res.status(502).json({ error: 'Could not verify the model connection. Check the Gemini API key, model, billing, and quota.' }) }
})
router.get('/context', async (req, res) => {
  const parsed = periodSchema.safeParse(req.query.period)
  if (!parsed.success) return res.status(400).json({ error: 'Select a supported reporting period.' })
  try { res.set('Cache-Control', 'no-store'); res.json(await retrieveAskContext(parsed.data)) } catch { res.status(500).json({ error: 'Could not retrieve workspace evidence.' }) }
})
const conversationSelect = {
  id: true, title: true, period: true, createdAt: true, updatedAt: true,
  messages: { orderBy: { createdAt: 'asc' as const }, take: 50, select: { id: true, role: true, content: true, evidence: true, createdAt: true } },
}
router.get('/conversations', async (req: AuthedRequest, res) => {
  const conversations = await prisma.vyomConversation.findMany({ where: { userId: req.user!.userId }, orderBy: { updatedAt: 'desc' }, take: 20, select: conversationSelect })
  res.set('Cache-Control', 'no-store')
  res.json(conversations)
})
router.post('/conversations', async (req: AuthedRequest, res) => {
  const parsed = z.object({ period: periodSchema.default('month') }).safeParse(req.body || {})
  if (!parsed.success) return res.status(400).json({ error: 'Select a supported reporting period.' })
  const conversation = await prisma.vyomConversation.create({ data: { userId: req.user!.userId, title: 'New conversation', period: parsed.data.period }, select: conversationSelect })
  res.status(201).json(conversation)
})
router.delete('/conversations/:id', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid conversation.' })
  const deleted = await prisma.vyomConversation.deleteMany({ where: { id, userId: req.user!.userId } })
  if (!deleted.count) return res.status(404).json({ error: 'Conversation not found.' })
  res.json({ success: true })
})
const publicProposal = (row: any) => ({ id: row.id, action: row.action, entityType: row.entityType, targetRef: row.targetRef, payload: row.payload, beforeValue: row.beforeValue, status: row.status, expiresAt: row.expiresAt, reviewedAt: row.reviewedAt, executedAt: row.executedAt, failureReason: row.failureReason, createdAt: row.createdAt })
router.get('/audits', async (_req, res) => {
  const rows = await prisma.vyomAccessAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { id: true, name: true, email: true } } } })
  res.set('Cache-Control', 'no-store')
  res.json(rows.map(row => ({ id: row.id, user: row.user, conversationId: row.conversationId, datasets: row.datasets, filters: row.filters, recordCount: row.recordCount, sensitiveRefused: row.sensitiveRefused, outcome: row.outcome, createdAt: row.createdAt })))
})
router.get('/proposals', async (req: AuthedRequest, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending'
  if (!['pending', 'approved', 'rejected', 'expired', 'executed', 'failed', 'all'].includes(status)) return res.status(400).json({ error: 'Invalid proposal status.' })
  await prisma.vyomProposal.updateMany({ where: { status: 'pending', expiresAt: { lte: new Date() } }, data: { status: 'expired' } })
  const rows = await prisma.vyomProposal.findMany({ where: { ...(status === 'all' ? {} : { status }) }, orderBy: { createdAt: 'desc' }, take: 50 })
  res.set('Cache-Control', 'no-store'); res.json(rows.map(publicProposal))
})
router.post('/proposals/:id/reject', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid proposal.' })
  const changed = await prisma.vyomProposal.updateMany({ where: { id, status: 'pending' }, data: { status: 'rejected', reviewedById: req.user!.userId, reviewedAt: new Date() } })
  if (!changed.count) return res.status(409).json({ error: 'This proposal is no longer pending.' })
  const row = await prisma.vyomProposal.findUnique({ where: { id } })
  await prisma.auditLog.create({ data: { action: 'vyom_proposal_reject', entityType: row!.entityType, entityId: row!.targetRef || String(row!.id), userId: req.user!.userId, newValue: JSON.stringify({ proposalId: id, status: 'rejected' }), ipAddress: req.ip || null, userAgent: req.get('user-agent')?.slice(0, 500) || null } })
  res.json(publicProposal(row))
})
router.post('/proposals/:id/approve', async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid proposal.' })
  const proposal = await prisma.vyomProposal.findFirst({ where: { id } })
  if (!proposal || proposal.status !== 'pending') return res.status(409).json({ error: 'This proposal is no longer pending.' })
  if (proposal.expiresAt <= new Date()) { await prisma.vyomProposal.update({ where: { id }, data: { status: 'expired', reviewedAt: new Date(), reviewedById: req.user!.userId } }); return res.status(409).json({ error: 'This proposal has expired.' }) }
  const payload = proposal.payload as any, before = proposal.beforeValue as any
  try {
    if (proposal.action === 'approve_leave') {
      const current = await prisma.leaveRequest.findUnique({ where: { id: proposal.targetId! } })
      if (!current || current.status !== 'pending' || (before?.updatedAt && current.updatedAt.toISOString() !== new Date(before.updatedAt).toISOString())) throw new Error('The leave request changed after this proposal was prepared.')
      if (current.leaveType === 'paid_time_off') await ensureMonthlyLeaveLimit(current.employeeId, current.startDate, current.endDate, Number(current.days), current.id)
    }
    if (proposal.action === 'update_subscription') {
      const current = await prisma.subscription.findUnique({ where: { id: proposal.targetId! }, select: { updatedAt: true } })
      if (!current || (before?.updatedAt && current.updatedAt.toISOString() !== new Date(before.updatedAt).toISOString())) throw new Error('The subscription changed after this proposal was prepared.')
    }
    const result = await prisma.$transaction(async db => {
      const claimed = await db.vyomProposal.updateMany({ where: { id, status: 'pending' }, data: { status: 'approved', reviewedById: req.user!.userId, reviewedAt: new Date() } })
      if (!claimed.count) throw new Error('This proposal is no longer pending.')
      let entityId = proposal.targetRef || ''
      if (proposal.action === 'create_task') {
        const project = await db.project.findUnique({ where: { id: Number(payload.projectId) }, select: { code: true } })
        if (!project) throw new Error('The target project no longer exists.')
        const sequence = await db.project.update({ where: { id: Number(payload.projectId) }, data: { issueSequence: { increment: 1 } }, select: { issueSequence: true } })
        const key = `${project.code.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 10)}-${sequence.issueSequence}`
        await db.workItem.create({ data: { key, projectId: Number(payload.projectId), type: 'task', summary: payload.summary, description: payload.description || null, status: 'backlog', priority: payload.priority || 'medium', assigneeId: payload.assigneeId || null, dueDate: payload.dueDate ? new Date(`${payload.dueDate}T00:00:00.000Z`) : null, reporterId: req.user!.userId, activities: { create: { actorId: req.user!.userId, action: 'created_from_vyom_proposal', details: `Approved proposal ${id}` } } } })
        entityId = key
      } else if (proposal.action === 'update_subscription') {
        await db.subscription.update({ where: { id: proposal.targetId! }, data: { ...payload, ...(payload.nextBillingDate !== undefined ? { nextBillingDate: payload.nextBillingDate ? new Date(`${payload.nextBillingDate}T00:00:00.000Z`) : null } : {}) } })
      } else if (proposal.action === 'approve_leave') {
        const reviewer = await db.user.findUnique({ where: { id: req.user!.userId }, select: { name: true, email: true } })
        await db.leaveRequest.update({ where: { id: proposal.targetId! }, data: { status: 'approved', approverName: reviewer?.name || reviewer?.email || 'Workspace administrator', blackoutChecked: true } })
      } else throw new Error('Unsupported proposal action.')
      await db.auditLog.create({ data: { action: 'vyom_proposal_execute', entityType: proposal.entityType, entityId, userId: req.user!.userId, previousValue: proposal.beforeValue ? JSON.stringify(proposal.beforeValue) : null, newValue: JSON.stringify(payload), ipAddress: req.ip || null, userAgent: req.get('user-agent')?.slice(0, 500) || null } })
      return db.vyomProposal.update({ where: { id }, data: { status: 'executed', executedAt: new Date() } })
    })
    res.json(publicProposal(result))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proposal execution failed.'
    await prisma.vyomProposal.updateMany({ where: { id, status: { in: ['pending', 'approved'] } }, data: { status: 'failed', failureReason: message.slice(0, 500), reviewedById: req.user!.userId, reviewedAt: new Date() } })
    res.status(409).json({ error: message })
  }
})
const active = new Set<number>()
router.post('/', async (req: AuthedRequest, res) => {
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a question of 3–1000 characters and select a supported period.' })
  const config = geminiConfiguration()
  if (!config) return res.status(503).json({ error: 'Vyom is awaiting model configuration. You can still view the available facts.' })
  const userId = req.user!.userId
  if (active.has(userId)) return res.status(429).json({ error: 'A question is already running. Please wait for it to finish.' })
  active.add(userId)
  let auditPlan: VyomReadPlan | null = null
  let auditConversationId: number | null = null
  try {
    let conversation = parsed.data.conversationId
      ? await prisma.vyomConversation.findFirst({ where: { id: parsed.data.conversationId, userId }, include: { messages: { orderBy: { createdAt: 'desc' }, take: 12 } } })
      : null
    if (parsed.data.conversationId && !conversation) return res.status(404).json({ error: 'Conversation not found.' })
    if (!conversation) conversation = await prisma.vyomConversation.create({ data: { userId, title: parsed.data.question.slice(0, 80), period: parsed.data.period }, include: { messages: true } })
    auditConversationId = conversation.id
    const storedHistory = [...conversation.messages].reverse().map(message => ({ role: message.role as 'user' | 'assistant', content: message.content }))
    const history = storedHistory.length ? storedHistory : parsed.data.history || []
    const requestedRange = questionDateRange([parsed.data.question, ...history.slice().reverse().map(message => message.content)].join('\n'))
    const readPlan = buildVyomReadPlan(parsed.data.question)
    auditPlan = readPlan
    const needsWorkspaceSummary = readPlan.datasets.length > 0 || /\b(workspace|happening|attention|overview|summary|today|our|we)\b/i.test(parsed.data.question)
    const baseContext = !readPlan.sensitiveRequested && needsWorkspaceSummary ? await cachedAskContext(parsed.data.period, requestedRange) : minimalAskContext(parsed.data.period, requestedRange)
    const context = addQuestionExpenseTotal(parsed.data.question, await addAllowlistedReadFacts(readPlan, baseContext))
    const wantsExpenseSheet = /\b(sheet|spreadsheet|csv|export|download)\b/i.test(parsed.data.question) && /\bexpense|expenses|spend|spending\b/i.test(parsed.data.question)
    const spendFact = context.facts.find(fact => fact.id === 'spend-total')
    const answer = readPlan.sensitiveRequested
      ? { status: 'insufficient_evidence' as const, scope: 'workspace' as const, answer: 'I cannot retrieve or reveal credentials, payroll, compensation, banking, tax identifiers, private contact details, private leave reasons, or asset serial numbers. Those fields are outside Vyom’s approved read access.', facts: [] as AskFact[] }
      : wantsExpenseSheet
      ? { status: 'answered' as const, scope: 'workspace' as const, answer: `I prepared the complete expense sheet for ${requestedRange?.label || 'the selected period'}. It contains ${spendFact?.count || 0} active expense rows totalling ${money(Number(spendFact?.amount || 0))}.`, facts: spendFact ? [spendFact] : [], artifact: { type: 'expense_csv', label: `Download ${requestedRange?.label || 'expense'} sheet`, href: `/api/flow/ask/expense-sheet?startDate=${encodeURIComponent(context.start)}&endDate=${encodeURIComponent(context.end)}`, filename: `expenses-${context.start.slice(0, 10)}-to-${context.end.slice(0, 10)}.csv`, rowCount: spendFact?.count || 0 } }
      : await answerWithGemini(parsed.data.question, context, config, history)
    const draft = await materializeProposal(userId, conversation.id, parsed.data.question, answer.scope === 'workspace' && 'proposal' in answer ? answer.proposal : null)
    const finalAnswer = { ...answer, ...(draft ? { proposal: publicProposal(draft) } : { proposal: undefined }) }
    const message = finalAnswer.answer || (finalAnswer.status === 'answered' ? 'Here is what I found.' : 'I cannot verify that from the information currently available to Vyom.')
    await prisma.$transaction([
      prisma.vyomMessage.create({ data: { conversationId: conversation.id, role: 'user', content: parsed.data.question } }),
      prisma.vyomMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: message, evidence: JSON.parse(JSON.stringify({ ...finalAnswer, period: context.period, start: context.start, end: context.end, retrievedAt: context.retrievedAt, coverage: context.coverage })) } }),
      prisma.vyomConversation.update({ where: { id: conversation.id }, data: { period: parsed.data.period, title: conversation.title === 'New conversation' ? parsed.data.question.slice(0, 80) : conversation.title } }),
      prisma.vyomAccessAudit.create({ data: { userId, conversationId: conversation.id, datasets: [...(needsWorkspaceSummary ? ['workspace_summary'] : []), ...readPlan.datasets], filters: readPlan.filters, recordCount: context.facts.filter(fact => !fact.id.startsWith('feature-')).length, sensitiveRefused: readPlan.sensitiveRequested, outcome: readPlan.sensitiveRequested ? 'refused' : 'answered', ipAddress: req.ip || null, userAgent: req.get('user-agent')?.slice(0, 500) || null } }),
      ...(draft ? [prisma.auditLog.create({ data: { action: 'vyom_proposal_prepare', entityType: draft.entityType, entityId: draft.targetRef || String(draft.id), userId, newValue: JSON.stringify({ proposalId: draft.id, action: draft.action, payload: draft.payload }), ipAddress: req.ip || null, userAgent: req.get('user-agent')?.slice(0, 500) || null } })] : []),
    ])
    res.set('Cache-Control', 'no-store')
    res.json({ ...finalAnswer, period: context.period, start: context.start, end: context.end, retrievedAt: context.retrievedAt, coverage: context.coverage, message, conversationId: conversation.id })
  } catch {
    if (auditPlan) await prisma.vyomAccessAudit.create({ data: { userId, conversationId: auditConversationId, datasets: auditPlan.datasets, filters: auditPlan.filters, recordCount: 0, sensitiveRefused: auditPlan.sensitiveRequested, outcome: 'failed', ipAddress: req.ip || null, userAgent: req.get('user-agent')?.slice(0, 500) || null } }).catch(() => undefined)
    res.status(502).json({ error: 'The model could not return a verified answer. Retry or view the available facts.' })
  }
  finally { active.delete(userId) }
})
export default router
