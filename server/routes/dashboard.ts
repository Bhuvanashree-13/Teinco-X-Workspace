import { Router } from 'express'
import { prisma } from '../db.js'
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, format } from 'date-fns'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

import { categoryBreakdownFor } from '../lib/dashboard-categories.js'

const router = Router()

router.use(requireAuth, requireAdmin)

router.get('/kpi', async (req, res) => {
  try {
    const now = new Date()
    const currentMonthStart = startOfMonth(now)
    const currentMonthEnd = now
    const currentYearStart = startOfYear(now)
    const currentYearEnd = now
    const prevMonthStart = startOfMonth(subMonths(now, 1))
    const prevMonthEnd = endOfMonth(subMonths(now, 1))
    const prevYearStart = startOfYear(subMonths(now, 12))
    const prevYearEnd = endOfYear(subMonths(now, 12))

    const deposits = await prisma.deposit.aggregate({
      where: { status: 'received', depositDate: { lte: now } },
      _sum: { baseCurrencyAmount: true },
      _count: true,
    })

    // Current month spend
    const currentMonthExpenses = await prisma.expense.aggregate({
      where: {
        expenseDate: { gte: currentMonthStart, lte: currentMonthEnd },
        status: 'active'
      },
      _sum: { baseCurrencyAmount: true }
    })

    // Previous month spend
    const prevMonthExpenses = await prisma.expense.aggregate({
      where: {
        expenseDate: { gte: prevMonthStart, lte: prevMonthEnd },
        status: 'active'
      },
      _sum: { baseCurrencyAmount: true }
    })

    // Current year spend
    const currentYearExpenses = await prisma.expense.aggregate({
      where: {
        expenseDate: { gte: currentYearStart, lte: currentYearEnd },
        status: 'active'
      },
      _sum: { baseCurrencyAmount: true }
    })

    // Previous year spend
    const prevYearExpenses = await prisma.expense.aggregate({
      where: {
        expenseDate: { gte: prevYearStart, lte: prevYearEnd },
        status: 'active'
      },
      _sum: { baseCurrencyAmount: true }
    })

    // Monthly average
    const recordedExpenses = await prisma.expense.findMany({
      where: { status: 'active' },
      select: { expenseDate: true, baseCurrencyAmount: true }
    })
    const allExpenses = recordedExpenses.filter(expense => expense.expenseDate <= now)

    const monthlyTotals: Record<string, number> = {}
    allExpenses.forEach(e => {
      const key = format(e.expenseDate, 'yyyy-MM')
      monthlyTotals[key] = (monthlyTotals[key] || 0) + Number(e.baseCurrencyAmount)
    })
    const monthCount = Object.keys(monthlyTotals).length || 1
    const monthlyAverage = Object.values(monthlyTotals).reduce((a, b) => a + b, 0) / monthCount

    // Recurring commitments
    const recurringMonthly = await prisma.expense.aggregate({
      where: {
        isRecurring: true,
        frequency: 'monthly',
        status: 'active'
      },
      _sum: { baseCurrencyAmount: true }
    })

    const recurringYearly = await prisma.expense.aggregate({
      where: {
        isRecurring: true,
        frequency: 'yearly',
        status: 'active'
      },
      _sum: { baseCurrencyAmount: true }
    })

    // By category
    const categorySpend = await prisma.expense.groupBy({
      by: ['categoryId'],
      where: {
        expenseDate: { gte: currentYearStart, lte: currentYearEnd },
        status: 'active'
      },
      _sum: { baseCurrencyAmount: true }
    })

    // Include child and archived categories: historical expenses retain their classification.
    const categories = await prisma.expenseCategory.findMany()
    const categoryBreakdown = categoryBreakdownFor(categorySpend, categories)
    const spendFor = (code: string) => categoryBreakdown
      .filter(category => category.code === code)
      .reduce((total, category) => total + category.amount, 0)

    // Upcoming expenses (next 30 days)
    const upcomingDate = new Date()
    upcomingDate.setDate(upcomingDate.getDate() + 30)
    const upcomingExpenses = await prisma.expense.findMany({
      where: {
        nextDueDate: { gte: new Date(), lte: upcomingDate },
        status: 'active',
        isRecurring: true
      },
      include: { vendor: true, category: true },
      orderBy: { nextDueDate: 'asc' },
      take: 10
    })
    const activeProjects = await prisma.project.findMany({
      where: { status: 'active' },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      include: { workItems: { where: { status: { not: 'done' } }, orderBy: { updatedAt: 'desc' }, take: 4, select: { id: true, key: true, summary: true, status: true, priority: true, assignee: { select: { name: true } } } }, _count: { select: { workItems: true } } },
    })

    // Monthly trend
    const monthlyTrend: Record<string, number> = {}
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(now, i)
      const key = format(d, 'MMM yyyy')
      monthlyTrend[key] = 0
    }

    allExpenses.forEach(e => {
      const key = format(e.expenseDate, 'MMM yyyy')
      if (monthlyTrend[key] !== undefined) {
        monthlyTrend[key] += Number(e.baseCurrencyAmount)
      }
    })

    res.json({
      currentMonthSpend: Number(currentMonthExpenses._sum.baseCurrencyAmount) || 0,
      previousMonthSpend: Number(prevMonthExpenses._sum.baseCurrencyAmount) || 0,
      currentYearSpend: Number(currentYearExpenses._sum.baseCurrencyAmount) || 0,
      previousYearSpend: Number(prevYearExpenses._sum.baseCurrencyAmount) || 0,
      monthlyAverage: Math.round(monthlyAverage),
      recurringMonthlyCommitment: Number(recurringMonthly._sum.baseCurrencyAmount) || 0,
      recurringAnnualCommitment: (Number(recurringMonthly._sum.baseCurrencyAmount) || 0) * 12 + (Number(recurringYearly._sum.baseCurrencyAmount) || 0),
      softwareSpend: spendFor('SOFTWARE'),
      cloudSpend: spendFor('CLOUD'),
      hardwareSpend: spendFor('HARDWARE'),
      peopleSpend: spendFor('PEOPLE'),
      categoryBreakdown,
      upcomingExpenses: upcomingExpenses.map(e => ({
        id: e.id,
        expenseId: e.expenseId,
        description: e.description,
        vendor: e.vendor?.name,
        category: e.category?.name,
        amount: Number(e.baseCurrencyAmount),
        dueDate: e.nextDueDate
      })),
      activeProjects,
      monthlyTrend: Object.entries(monthlyTrend).map(([month, amount]) => ({ month, amount })),
      totalExpenses: allExpenses.filter(expense => expense.expenseDate >= currentYearStart).length,
      asOf: now.toISOString(),
      totalDeposits: Number(deposits._sum.baseCurrencyAmount) || 0,
      depositCount: deposits._count,
      availableBalance: (Number(deposits._sum.baseCurrencyAmount) || 0) - recordedExpenses.reduce((total, expense) => total + Number(expense.baseCurrencyAmount), 0)
    })
  } catch (error) {
    console.error('Dashboard KPI error:', error)
    res.status(500).json({ error: 'Failed to load dashboard data' })
  }
})

const detailMetrics = ['balance', 'deposits', 'mtd', 'ytd', 'average', 'recurring', 'software', 'cloud', 'people', 'hardware', 'category'] as const
type DetailMetric = typeof detailMetrics[number]
const categoryCodes: Partial<Record<DetailMetric, string>> = { software: 'SOFTWARE', cloud: 'CLOUD', people: 'PEOPLE', hardware: 'HARDWARE' }
const DETAIL_ROW_LIMIT = 2000

// Returns the root category plus every descendant, matching how the KPI rolls subcategories up.
function categoryTreeIds(rootIds: number[], categories: Array<{ id: number; parentId: number | null }>) {
  const ids = new Set(rootIds)
  let added = true
  while (added) {
    added = false
    for (const category of categories) {
      if (category.parentId != null && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id)
        added = true
      }
    }
  }
  return [...ids]
}

// Records behind a single KPI card, filtered exactly as /kpi computes that card.
router.get('/details', async (req, res) => {
  try {
    const metric = String(req.query.metric || '') as DetailMetric
    if (!detailMetrics.includes(metric)) return res.status(400).json({ error: 'Unknown dashboard metric' })
    const now = new Date()
    const expenseWhere: Record<string, unknown> = { status: 'active' }
    let includeDeposits = false
    let includeExpenses = true

    if (metric === 'balance') includeDeposits = true
    if (metric === 'deposits') { includeDeposits = true; includeExpenses = false }
    if (metric === 'mtd') expenseWhere.expenseDate = { gte: startOfMonth(now), lte: now }
    if (metric === 'ytd') expenseWhere.expenseDate = { gte: startOfYear(now), lte: now }
    if (metric === 'average') expenseWhere.expenseDate = { lte: now }
    if (metric === 'recurring') Object.assign(expenseWhere, { isRecurring: true, frequency: 'monthly' })
    if (categoryCodes[metric] || metric === 'category') {
      const categories = await prisma.expenseCategory.findMany({ select: { id: true, parentId: true, code: true } })
      const rootIds = metric === 'category'
        ? [Number(req.query.categoryId)].filter(Number.isInteger)
        : categories.filter(category => category.code === categoryCodes[metric] && category.parentId == null).map(category => category.id)
      if (metric === 'category' && !rootIds.length) return res.status(400).json({ error: 'categoryId is required' })
      expenseWhere.expenseDate = { gte: startOfYear(now), lte: now }
      expenseWhere.categoryId = { in: categoryTreeIds(rootIds, categories) }
    }

    const [expenses, deposits] = await Promise.all([
      includeExpenses ? prisma.expense.findMany({
        where: expenseWhere,
        include: { vendor: { select: { name: true } }, category: { select: { name: true, color: true } } },
        orderBy: { expenseDate: 'desc' },
        take: DETAIL_ROW_LIMIT + 1,
      }) : Promise.resolve([]),
      includeDeposits ? prisma.deposit.findMany({
        where: { status: 'received', depositDate: { lte: now } },
        orderBy: { depositDate: 'desc' },
        take: DETAIL_ROW_LIMIT + 1,
      }) : Promise.resolve([]),
    ])

    const rows = [
      ...expenses.slice(0, DETAIL_ROW_LIMIT).map(expense => ({
        kind: 'expense' as const,
        id: expense.id,
        ref: expense.expenseId,
        date: expense.expenseDate,
        description: expense.description,
        party: expense.vendor?.name || null,
        category: expense.category?.name || 'Uncategorized',
        color: expense.category?.color || '#64748b',
        frequency: expense.isRecurring ? expense.frequency : null,
        amount: Number(expense.baseCurrencyAmount) || 0,
      })),
      ...deposits.slice(0, DETAIL_ROW_LIMIT).map(deposit => ({
        kind: 'deposit' as const,
        id: deposit.id,
        ref: deposit.depositId,
        date: deposit.depositDate,
        description: deposit.description || deposit.source,
        party: deposit.source,
        category: 'Deposit',
        color: '#12A06A',
        frequency: null,
        amount: Number(deposit.baseCurrencyAmount) || 0,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    res.json({ metric, asOf: now.toISOString(), truncated: expenses.length > DETAIL_ROW_LIMIT || deposits.length > DETAIL_ROW_LIMIT, rows })
  } catch (error) {
    console.error('Dashboard details error:', error)
    res.status(500).json({ error: 'Failed to load dashboard details' })
  }
})

export default router
