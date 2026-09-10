import { Router } from 'express'
import { z } from 'zod'
import { startOfMonth, startOfYear, subMonths, endOfMonth } from 'date-fns'
import { prisma } from '../db.js'
import { categoryBreakdownFor } from '../lib/dashboard-categories.js'
import { vendorBreakdownFor } from '../lib/analytics-vendors.js'
import { answerWithOllama, ollamaConfiguration, type AskContext, type AskFact } from '../lib/ask-ai.js'
import type { AuthedRequest } from '../middleware/auth.js'
const router = Router()
const periodSchema = z.enum(['month', 'last_month', 'year'])
const requestSchema = z.object({ question: z.string().trim().min(3).max(1000), period: periodSchema }).strict()
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
  const source = { label: 'Expense records in this period', href: `/expenses?${range}` }
  const spend = Number(total._sum.baseCurrencyAmount) || 0
  const received = Number(deposits._sum.baseCurrencyAmount) || 0
  const facts: AskFact[] = [
    { id: 'spend-total', text: `Recorded spending is ${money(spend)} across ${total._count} active expenses in the selected period.`, amount: spend, count: total._count, source },
    { id: 'deposit-total', text: `Received deposits total ${money(received)} across ${deposits._count} deposits in the selected period.`, amount: received, count: deposits._count, source: { label: 'Received deposits in this period', href: `/deposits?${range}` } },
    { id: 'period-net', text: `Received deposits minus recorded expenses for this period is ${money(received - spend)}. This is a period movement, not a bank balance.`, amount: received - spend, source },
  ]
  const categoryRows = categoryBreakdownFor(categorySpend, categories)
  for (const [index, row] of categoryRows.slice(0, 20).entries()) facts.push({ id: `category-${index}`, text: `Category rank ${index + 1}: ${row.category.slice(0, 120)} — ${money(row.amount)}, including subcategories.`, amount: row.amount, source })
  const vendorRows = vendorBreakdownFor(vendorSpend, vendors)
  for (const [index, row] of vendorRows.filter(row => row.kind === 'vendor').slice(0, 20).entries()) facts.push({ id: `vendor-${index}`, text: `Vendor rank ${index + 1}: ${row.vendor.slice(0, 120)} — ${money(row.amount)} across ${row.transactions} expenses.`, amount: row.amount, count: row.transactions, source })
  for (const row of vendorRows.filter(row => row.kind !== 'vendor')) facts.push({ id: row.key, text: `${row.vendor}: ${money(row.amount)} across ${row.transactions} expenses; excluded from vendor rankings.`, amount: row.amount, count: row.transactions, source })
  for (const [index, row] of largest.entries()) facts.push({ id: `expense-${index}`, text: `Expense rank ${index + 1}: ${row.expenseId}, ${money(Number(row.baseCurrencyAmount))}, dated ${row.expenseDate.toISOString().slice(0, 10)}.`, amount: Number(row.baseCurrencyAmount), source: { label: row.expenseId, href: `/expenses?search=${encodeURIComponent(row.expenseId)}` } })
  return { period, start: start.toISOString(), end: end.toISOString(), retrievedAt: now.toISOString(), facts, coverage: ['Totals cover all matching active expenses and received deposits. Dates follow the server timezone, as in dashboard analytics.', `Rankings include up to 20 of ${categoryRows.length} categories, 20 of ${vendorRows.filter(row => row.kind === 'vendor').length} vendors, and the 10 largest expenses.`, 'No invoice attachments, private employee details, subscriptions, causes, predictions, or external ERP data are included. Each question is independent.'] }
}
router.get('/config', (_req, res) => {
  const config = ollamaConfiguration()
  res.set('Cache-Control', 'no-store')
  res.json({ enabled: Boolean(config), provider: 'Ollama', model: config?.model || null, readOnly: true })
})
router.post('/test', async (_req, res) => {
  const config = ollamaConfiguration()
  if (!config) return res.status(503).json({ error: 'Set ASK_AI_OLLAMA_URL and ASK_AI_MODEL on the app server, then restart it.' })
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
    const context = await retrieveAskContext(parsed.data.period)
    const answer = await answerWithOllama(parsed.data.question, context, config)
    res.set('Cache-Control', 'no-store')
    res.json({ ...answer, period: context.period, start: context.start, end: context.end, retrievedAt: context.retrievedAt, coverage: context.coverage, message: answer.status === 'answered' ? 'These verified records answer your question for the selected period.' : 'The available facts do not support an answer. Try a question about recorded spending, deposits, categories, vendors, or the largest expenses in the selected period.' })
  } catch { res.status(502).json({ error: 'The model could not return a verified answer. Retry or view the available facts.' }) }
  finally { active.delete(userId) }
})
export default router
