import { Router } from 'express'
import { prisma } from '../db.js'
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, format } from 'date-fns'

const router = Router()

router.get('/kpi', async (req, res) => {
  try {
    const now = new Date()
    const currentMonthStart = startOfMonth(now)
    const currentMonthEnd = endOfMonth(now)
    const currentYearStart = startOfYear(now)
    const currentYearEnd = endOfYear(now)
    const prevMonthStart = startOfMonth(subMonths(now, 1))
    const prevMonthEnd = endOfMonth(subMonths(now, 1))
    const prevYearStart = startOfYear(subMonths(now, 12))
    const prevYearEnd = endOfYear(subMonths(now, 12))

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
    const allExpenses = await prisma.expense.findMany({
      where: { status: 'active' },
      select: { expenseDate: true, baseCurrencyAmount: true }
    })

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

    const categories = await prisma.expenseCategory.findMany({
      where: { parentId: null, isActive: true }
    })

    const categoryMap = new Map(categories.map(c => [c.id, c]))
    const categoryBreakdown = categorySpend.map(cs => ({
      category: categoryMap.get(cs.categoryId)?.name || 'Unknown',
      color: categoryMap.get(cs.categoryId)?.color || '#6b7280',
      amount: Number(cs._sum.baseCurrencyAmount) || 0
    })).sort((a, b) => b.amount - a.amount)

    // Software spend
    const softwareCategory = categories.find(c => c.code === 'SOFTWARE')
    const softwareSpend = softwareCategory ? await prisma.expense.aggregate({
      where: {
        categoryId: softwareCategory.id,
        expenseDate: { gte: currentYearStart, lte: currentYearEnd },
        status: 'active'
      },
      _sum: { baseCurrencyAmount: true }
    }) : { _sum: { baseCurrencyAmount: 0 } }

    // Cloud spend
    const cloudCategory = categories.find(c => c.code === 'CLOUD')
    const cloudSpend = cloudCategory ? await prisma.expense.aggregate({
      where: {
        categoryId: cloudCategory.id,
        expenseDate: { gte: currentYearStart, lte: currentYearEnd },
        status: 'active'
      },
      _sum: { baseCurrencyAmount: true }
    }) : { _sum: { baseCurrencyAmount: 0 } }

    // Hardware spend
    const hardwareCategory = categories.find(c => c.code === 'HARDWARE')
    const hardwareSpend = hardwareCategory ? await prisma.expense.aggregate({
      where: {
        categoryId: hardwareCategory.id,
        expenseDate: { gte: currentYearStart, lte: currentYearEnd },
        status: 'active'
      },
      _sum: { baseCurrencyAmount: true }
    }) : { _sum: { baseCurrencyAmount: 0 } }

    // People spend
    const peopleCategory = categories.find(c => c.code === 'PEOPLE')
    const peopleSpend = peopleCategory ? await prisma.expense.aggregate({
      where: {
        categoryId: peopleCategory.id,
        expenseDate: { gte: currentYearStart, lte: currentYearEnd },
        status: 'active'
      },
      _sum: { baseCurrencyAmount: true }
    }) : { _sum: { baseCurrencyAmount: 0 } }

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
      softwareSpend: Number(softwareSpend._sum.baseCurrencyAmount) || 0,
      cloudSpend: Number(cloudSpend._sum.baseCurrencyAmount) || 0,
      hardwareSpend: Number(hardwareSpend._sum.baseCurrencyAmount) || 0,
      peopleSpend: Number(peopleSpend._sum.baseCurrencyAmount) || 0,
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
      monthlyTrend: Object.entries(monthlyTrend).map(([month, amount]) => ({ month, amount })),
      totalExpenses: allExpenses.length
    })
  } catch (error) {
    console.error('Dashboard KPI error:', error)
    res.status(500).json({ error: 'Failed to load dashboard data' })
  }
})

export default router
