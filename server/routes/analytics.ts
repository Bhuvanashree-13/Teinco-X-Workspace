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
