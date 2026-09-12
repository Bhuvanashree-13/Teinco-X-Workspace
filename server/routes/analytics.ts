import { Router } from 'express'
import { prisma } from '../db.js'
import { startOfYear, endOfYear } from 'date-fns'

import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { categoryBreakdownFor } from '../lib/dashboard-categories.js'
import { vendorBreakdownFor } from '../lib/analytics-vendors.js'

const router = Router()
router.use(requireAuth, requireAdmin)

router.get('/spend-by-category', async (req, res) => {
  try {
    const year = req.query.year === undefined ? new Date().getFullYear() : Number(req.query.year)
    if (!Number.isInteger(year) || year < 1900 || year > 9999) return res.status(400).json({ error: 'Invalid reporting year' })
    const start = startOfYear(new Date(year, 0, 1))
    const end = new Date(Math.min(endOfYear(new Date(year, 0, 1)).getTime(), Date.now()))

    const data = await prisma.expense.groupBy({
      by: ['categoryId'],
      where: { expenseDate: { gte: start, lte: end }, status: 'active' },
      _sum: { baseCurrencyAmount: true }
    })

    const categories = await prisma.expenseCategory.findMany()
    res.json(categoryBreakdownFor(data, categories))
  } catch (error) {
    res.status(500).json({ error: 'Analytics failed' })
  }
})

router.get('/spend-by-vendor', async (req, res) => {
  try {
    const year = req.query.year === undefined ? new Date().getFullYear() : Number(req.query.year)
    if (!Number.isInteger(year) || year < 1900 || year > 9999) return res.status(400).json({ error: 'Invalid reporting year' })
    const start = startOfYear(new Date(year, 0, 1))
    const end = new Date(Math.min(endOfYear(new Date(year, 0, 1)).getTime(), Date.now()))

    const data = await prisma.expense.groupBy({
      by: ['vendorId', 'expenseType'],
      where: { expenseDate: { gte: start, lte: end }, status: 'active' },
      _sum: { baseCurrencyAmount: true },
      _count: true
    })

    const vendors = await prisma.vendor.findMany()
    res.json(vendorBreakdownFor(data, vendors))
  } catch (error) {
    res.status(500).json({ error: 'Analytics failed' })
  }
})

router.get('/project-allocation', async (req, res) => {
  try {
    const year = req.query.year === undefined ? new Date().getFullYear() : Number(req.query.year)
    if (!Number.isInteger(year) || year < 1900 || year > 9999) return res.status(400).json({ error: 'Invalid reporting year' })
    const start = startOfYear(new Date(year, 0, 1))
    const end = new Date(Math.min(endOfYear(new Date(year, 0, 1)).getTime(), Date.now()))

    const data = await prisma.expense.groupBy({
      by: ['projectId'],
      where: { expenseDate: { gte: start, lte: end }, status: 'active' },
      _sum: { baseCurrencyAmount: true }
    })

    const projects = await prisma.project.findMany()
    const projMap = new Map(projects.map(p => [p.id, p]))

    res.json(data.map(d => ({
      projectId: d.projectId,
      project: d.projectId ? projMap.get(d.projectId)?.name || `Unavailable project #${d.projectId}` : 'No project assigned',
      color: d.projectId ? projMap.get(d.projectId)?.color || '#6b7280' : '#6b7280',
      amount: Number(d._sum.baseCurrencyAmount) || 0
    })))
  } catch (error) {
    res.status(500).json({ error: 'Analytics failed' })
  }
})

router.get('/advisory', async (req, res) => {
  try {
    const year = req.query.year === undefined ? new Date().getFullYear() : Number(req.query.year)
    if (!Number.isInteger(year) || year < 1900 || year > 9999) return res.status(400).json({ error: 'Invalid reporting year' })
    const start = startOfYear(new Date(year, 0, 1)), end = new Date(Math.min(endOfYear(start).getTime(), Date.now()))
    const elapsed = Math.max(1, end.getTime() - start.getTime()), priorEnd = new Date(start.getTime() - 1), priorStart = new Date(priorEnd.getTime() - elapsed)
    const where = { status: 'active', expenseDate: { gte: start, lte: end } }
    const [current, prior, categories, vendors, projects, open, blocked, overdue] = await Promise.all([
      prisma.expense.aggregate({ where, _sum: { baseCurrencyAmount: true }, _count: true }),
      prisma.expense.aggregate({ where: { status: 'active', expenseDate: { gte: priorStart, lte: priorEnd } }, _sum: { baseCurrencyAmount: true } }),
      prisma.expense.groupBy({ by: ['categoryId'], where, _sum: { baseCurrencyAmount: true } }),
      prisma.expense.groupBy({ by: ['vendorId'], where: { ...where, vendorId: { not: null } }, _sum: { baseCurrencyAmount: true } }),
      prisma.project.findMany({ where: { status: { not: 'archived' } }, include: { workItems: { select: { status: true, storyPoints: true, dueDate: true } }, expenses: { where, select: { baseCurrencyAmount: true } } } }),
      prisma.workItem.count({ where: { status: { not: 'done' } } }), prisma.workItem.count({ where: { status: 'blocked' } }), prisma.workItem.count({ where: { status: { not: 'done' }, dueDate: { lt: new Date() } } }),
    ])
    const spend = Number(current._sum.baseCurrencyAmount) || 0, previous = Number(prior._sum.baseCurrencyAmount) || 0
    const change = previous ? (spend - previous) / previous * 100 : null
    const topCategory = Math.max(0, ...categories.map(row => Number(row._sum.baseCurrencyAmount) || 0)), topVendor = Math.max(0, ...vendors.map(row => Number(row._sum.baseCurrencyAmount) || 0))
    const categoryConcentration = spend > 0 ? topCategory / spend * 100 : 0, vendorConcentration = spend > 0 ? topVendor / spend * 100 : 0
    const findings = [
      { severity: change !== null && change > 20 ? 'high' : 'standard', title: 'Spending trajectory', observation: change === null ? 'There is no comparable prior-period spend baseline.' : `Recorded spend is ${Math.abs(change).toFixed(1)}% ${change >= 0 ? 'above' : 'below'} the comparable prior period.`, implication: change !== null && change > 20 ? 'The current run rate warrants category-level review before new commitments.' : 'The recorded run rate is within the default 20% review threshold.', recommendation: change !== null && change > 20 ? 'Review the largest category and confirm remaining commitments against budget.' : 'Continue monthly monitoring and investigate material category changes.', confidence: previous > 0 ? 'high' : 'low', method: 'Compares active ledger expense totals over equal elapsed calendar periods.' },
      { severity: vendorConcentration > 40 ? 'high' : 'standard', title: 'Vendor concentration', observation: `The largest vendor represents ${vendorConcentration.toFixed(1)}% of recorded spend.`, implication: vendorConcentration > 40 ? 'A single supplier has material cost concentration.' : 'No supplier crosses the default 40% concentration threshold.', recommendation: vendorConcentration > 40 ? 'Validate continuity, pricing, renewal terms, and an alternate supplier.' : 'Review concentration quarterly and before major renewals.', confidence: vendors.length ? 'high' : 'low', method: 'Largest assigned vendor spend divided by total active expense spend.' },
      { severity: blocked + overdue > 0 ? 'high' : 'standard', title: 'Delivery exposure', observation: `${blocked} work items are blocked and ${overdue} open items are overdue across ${open} open items.`, implication: blocked + overdue > 0 ? 'Delivery dates may be exposed unless dependencies are resolved.' : 'No recorded blocker or overdue signal is present.', recommendation: blocked + overdue > 0 ? 'Assign owners to blockers and review overdue items in the next delivery meeting.' : 'Maintain due dates and estimates so this signal remains reliable.', confidence: open ? 'medium' : 'low', method: 'Counts current project work items by workflow status and due date.' },
      { severity: categoryConcentration > 50 ? 'high' : 'standard', title: 'Category concentration', observation: `The largest cost category represents ${categoryConcentration.toFixed(1)}% of recorded spend.`, implication: categoryConcentration > 50 ? 'Cost exposure is concentrated in one operating area.' : 'Spend is distributed below the default 50% category threshold.', recommendation: 'Open the category breakdown to validate its transactions and business purpose.', confidence: categories.length ? 'high' : 'low', method: 'Largest parent-inclusive category total divided by active expense spend.' },
    ]
    const portfolio = projects.map(project => { const total = project.workItems.length, done = project.workItems.filter(item => item.status === 'done').length, projectBlocked = project.workItems.filter(item => item.status === 'blocked').length, projectOverdue = project.workItems.filter(item => item.status !== 'done' && item.dueDate && item.dueDate < new Date()).length, projectSpend = project.expenses.reduce((sum, row) => sum + Number(row.baseCurrencyAmount), 0), budget = Number(project.budget) || 0; return { id: project.id, code: project.code, name: project.name, color: project.color, deliveryScore: total ? Math.round(done / total * 100) : 0, budgetUsed: budget ? Math.round(projectSpend / budget * 100) : null, blocked: projectBlocked, overdue: projectOverdue, quadrant: projectBlocked || projectOverdue || (budget && projectSpend > budget) ? 'Intervene' : total && done / total >= .7 ? 'Accelerate' : 'Monitor' } })
    res.json({ year, generatedAt: new Date().toISOString(), metrics: { spend, transactions: current._count, change, categoryConcentration, vendorConcentration, open, blocked, overdue }, findings, portfolio, methodology: 'Decision support from recorded Teinco-X data. Thresholds are transparent defaults, not external market benchmarks.' })
  } catch { res.status(500).json({ error: 'Could not generate advisory analytics' }) }
})

router.get('/spending-details', async (req, res) => {
  try {
    const year = Number(req.query.year)
    const group = String(req.query.group || '')
    const key = String(req.query.key || '')
    if (!Number.isInteger(year) || year < 1900 || year > 9999) return res.status(400).json({ error: 'Invalid reporting year' })
    if (!['category', 'vendor', 'project'].includes(group)) return res.status(400).json({ error: 'Invalid spending group' })
    const start = startOfYear(new Date(year, 0, 1))
    const end = new Date(Math.min(endOfYear(new Date(year, 0, 1)).getTime(), Date.now()))
    const where: any = { expenseDate: { gte: start, lte: end }, status: 'active' }
    if (group === 'category') {
      const categoryId = Number(key)
      if (!Number.isInteger(categoryId)) return res.status(400).json({ error: 'Invalid category' })
      const categories = await prisma.expenseCategory.findMany({ select: { id: true, parentId: true } })
      const ids = new Set([categoryId])
      let changed = true
      while (changed) { changed = false; for (const category of categories) if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) { ids.add(category.id); changed = true } }
      where.categoryId = { in: [...ids] }
    } else if (group === 'project') {
      where.projectId = key === 'unassigned' ? null : Number(key)
    } else if (key.startsWith('vendor-')) {
      where.vendorId = Number(key.slice(7))
    } else if (key === 'internal') {
      where.vendorId = null; where.expenseType = 'salary'
    } else if (key === 'unassigned') {
      where.vendorId = null; where.expenseType = { not: 'salary' }
    } else return res.status(400).json({ error: 'Invalid vendor group' })
    const expenses = await prisma.expense.findMany({ where, include: { vendor: { select: { name: true } }, category: { select: { name: true } }, project: { select: { name: true } } }, orderBy: { expenseDate: 'desc' }, take: 250 })
    res.json(expenses.map(expense => ({ id: expense.id, expenseId: expense.expenseId, description: expense.description, expenseDate: expense.expenseDate, amount: Number(expense.baseCurrencyAmount), baseAmount: Number(expense.baseAmount), gstAmount: Number(expense.gstAmount), vendor: expense.vendor?.name || null, category: expense.category?.name || null, project: expense.project?.name || null })))
  } catch (error) {
    res.status(500).json({ error: 'Could not load spending details' })
  }
})

export default router
