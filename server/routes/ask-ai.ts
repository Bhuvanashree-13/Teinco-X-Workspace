import { Router } from 'express'
import { z } from 'zod'
import { startOfMonth, startOfYear, subMonths, endOfMonth, startOfDay, endOfDay, addDays } from 'date-fns'
import { prisma } from '../db.js'
import { categoryBreakdownFor } from '../lib/dashboard-categories.js'
import { vendorBreakdownFor } from '../lib/analytics-vendors.js'
import { answerWithOllama, ollamaConfiguration, type AskContext, type AskFact } from '../lib/ask-ai.js'
import type { AuthedRequest } from '../middleware/auth.js'
const router = Router()
const periodSchema = z.enum(['month', 'last_month', 'year'])
const historySchema = z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) }).strict()).max(12).default([])
const requestSchema = z.object({ question: z.string().trim().min(3).max(1000), period: periodSchema, history: historySchema.optional(), conversationId: z.number().int().positive().optional() }).strict()
const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)

export async function retrieveAskContext(period: z.infer<typeof periodSchema>): Promise<AskContext> {
  const now = new Date()
  const start = period === 'year' ? startOfYear(now) : startOfMonth(period === 'last_month' ? subMonths(now, 1) : now)
  const end = period === 'last_month' ? endOfMonth(subMonths(now, 1)) : now
  const where = { status: 'active', expenseDate: { gte: start, lte: end } }
  const range = `startDate=${encodeURIComponent(start.toISOString())}&endDate=${encodeURIComponent(end.toISOString())}`
  const [total, deposits, categorySpend, categories, vendorSpend, vendors, largest] = await prisma.$transaction(async db => Promise.all([
    db.expense.aggregate({ where, _sum: { baseCurrencyAmount: true }, _count: true }),
    db.deposit.aggregate({ where: { status: 'received', depositDate: { gte: start, lte: end } }, _sum: { baseCurrencyAmount: true }, _count: true }),
    db.expense.groupBy({ by: ['categoryId'], where, _sum: { baseCurrencyAmount: true } }),
    db.expenseCategory.findMany(),
    db.expense.groupBy({ by: ['vendorId', 'expenseType'], where, _sum: { baseCurrencyAmount: true }, _count: true }),
    db.vendor.findMany({ select: { id: true, name: true } }),
    db.expense.findMany({ where, orderBy: [{ baseCurrencyAmount: 'desc' }, { id: 'asc' }], take: 10, select: { expenseId: true, baseCurrencyAmount: true, expenseDate: true } }),
  ]))
  const todayStart = startOfDay(now), todayEnd = endOfDay(now), upcomingEnd = addDays(now, 30)
  const [activeEmployees, pendingLeave, attendanceToday, openTasks, blockedTasks, upcomingEvents, openMilestones, urgentInsights, activeSubscriptions] = await prisma.$transaction(async db => Promise.all([
    db.employee.count({ where: { isArchived: false, status: { in: ['active', 'on_leave', 'contractor'] } } }),
    db.leaveRequest.count({ where: { status: 'pending' } }),
    db.attendanceLog.count({ where: { workDate: { gte: todayStart, lte: todayEnd } } }),
    db.lifecycleTask.count({ where: { status: { in: ['open', 'in_progress', 'blocked'] } } }),
    db.lifecycleTask.count({ where: { status: 'blocked' } }),
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
    { id: 'tasks-open', text: `${openTasks} Taskboard tasks are open, in progress, or blocked.`, count: openTasks, source: { label: 'Taskboard', href: '/people' } },
    { id: 'tasks-blocked', text: `${blockedTasks} Taskboard tasks are currently blocked.`, count: blockedTasks, source: { label: 'Taskboard', href: '/people' } },
    { id: 'milestones-upcoming', text: `${openMilestones} open milestones are due within the next 30 days.`, count: openMilestones, source: { label: 'Schedule milestones', href: '/schedule' } },
    { id: 'insights-urgent', text: `${urgentInsights} urgent workspace insights are open.`, count: urgentInsights, source: { label: 'Flow insights', href: '/flow' } },
    { id: 'subscriptions-active', text: `${activeSubscriptions} subscriptions are active or in trial.`, count: activeSubscriptions, source: { label: 'Subscriptions', href: '/subscriptions' } },
  ]
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
  return { period, start: start.toISOString(), end: end.toISOString(), retrievedAt: now.toISOString(), facts, coverage: ['Finance facts use the selected reporting period. People and attendance facts reflect the current workspace; schedule facts cover the next 30 days.', `Rankings include up to 20 of ${categoryRows.length} categories, 20 of ${vendorRows.filter(row => row.kind === 'vendor').length} vendors, and the 10 largest expenses.`, 'Vyom can continue a conversation using the last 12 messages. It cannot change records or answer from data outside this workspace evidence.'] }
}
router.get('/config', (_req, res) => {
  const config = ollamaConfiguration()
  res.set('Cache-Control', 'no-store')
  res.json({ enabled: Boolean(config), provider: 'Ollama', model: config?.model || null, readOnly: true })
})
router.post('/test', async (_req, res) => {
  const config = ollamaConfiguration()
  if (!config) return res.status(503).json({ error: 'Set VYOM_OLLAMA_URL and ASK_AI_MODEL on the app server, then restart it.' })
  try {
    const now = new Date().toISOString()
    const answer = await answerWithOllama('How much was spent in the selected period?', {
      period: 'month', start: now, end: now, retrievedAt: now, coverage: [],
      facts: [{ id: 'spend-total', text: 'Recorded spending is INR 100 in the selected period.', source: { label: 'Connection test', href: '/flow' } }],
    }, config)
    if (answer.status !== 'answered' || !answer.facts.length) throw new Error('Invalid answer')
    res.set('Cache-Control', 'no-store')
    res.json({ message: `Connected to ${config.model}. Verified answer test passed.` })
  } catch { res.status(502).json({ error: 'Could not verify the model connection. Check the server endpoint, installed model, and gateway credentials.' }) }
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
const active = new Set<number>()
router.post('/', async (req: AuthedRequest, res) => {
  const parsed = requestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a question of 3–1000 characters and select a supported period.' })
  const config = ollamaConfiguration()
  if (!config) return res.status(503).json({ error: 'Vyom is awaiting model configuration. You can still view the available facts.' })
  const userId = req.user!.userId
  if (active.has(userId)) return res.status(429).json({ error: 'A question is already running. Please wait for it to finish.' })
  active.add(userId)
  try {
    let conversation = parsed.data.conversationId
      ? await prisma.vyomConversation.findFirst({ where: { id: parsed.data.conversationId, userId }, include: { messages: { orderBy: { createdAt: 'desc' }, take: 12 } } })
      : null
    if (parsed.data.conversationId && !conversation) return res.status(404).json({ error: 'Conversation not found.' })
    if (!conversation) conversation = await prisma.vyomConversation.create({ data: { userId, title: parsed.data.question.slice(0, 80), period: parsed.data.period }, include: { messages: true } })
    const storedHistory = [...conversation.messages].reverse().map(message => ({ role: message.role as 'user' | 'assistant', content: message.content }))
    const history = storedHistory.length ? storedHistory : parsed.data.history || []
    const context = await retrieveAskContext(parsed.data.period)
    const answer = await answerWithOllama(parsed.data.question, context, config, history)
    const message = answer.status === 'answered' ? 'Here is what I found in the current workspace records.' : 'I cannot verify that from the information currently stored in this app. Ask about Finance, People, attendance, leave, Taskboard, Schedule, subscriptions, or Flow.'
    await prisma.$transaction([
      prisma.vyomMessage.create({ data: { conversationId: conversation.id, role: 'user', content: parsed.data.question } }),
      prisma.vyomMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: message, evidence: JSON.parse(JSON.stringify({ ...answer, period: context.period, start: context.start, end: context.end, retrievedAt: context.retrievedAt, coverage: context.coverage })) } }),
      prisma.vyomConversation.update({ where: { id: conversation.id }, data: { period: parsed.data.period, title: conversation.title === 'New conversation' ? parsed.data.question.slice(0, 80) : conversation.title } }),
    ])
    res.set('Cache-Control', 'no-store')
    res.json({ ...answer, period: context.period, start: context.start, end: context.end, retrievedAt: context.retrievedAt, coverage: context.coverage, message, conversationId: conversation.id })
  } catch { res.status(502).json({ error: 'The model could not return a verified answer. Retry or view the available facts.' }) }
  finally { active.delete(userId) }
})
export default router
