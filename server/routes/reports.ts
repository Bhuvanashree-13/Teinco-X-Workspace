import { Router } from 'express'
import { prisma } from '../db.js'

const router = Router()

router.post('/generate', async (req, res) => {
  try {
    const { dateRange, categories, vendors, projects, expenseTypes } = req.body
    const where: any = { status: 'active' }

    if (dateRange) {
      where.expenseDate = { gte: new Date(dateRange.start), lte: new Date(dateRange.end) }
    }
    if (categories?.length) where.categoryId = { in: categories }
    if (vendors?.length) where.vendorId = { in: vendors }
    if (projects?.length) where.projectId = { in: projects }
    if (expenseTypes?.length) where.expenseType = { in: expenseTypes }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        vendor: { select: { name: true } },
        category: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { expenseDate: 'desc' }
    })

    res.json({ expenses, total: expenses.length, generatedAt: new Date() })
  } catch (error) {
    res.status(500).json({ error: 'Report generation failed' })
  }
})

export default router
