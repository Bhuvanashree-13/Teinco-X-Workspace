import { Router } from 'express'
import { prisma } from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { name: 'asc' }
    })
    res.json(projects)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load projects' })
  }
})

router.get('/:id/spend', async (req, res) => {
  try {
    const projectId = Number(req.params.id)
    const currentYear = new Date().getFullYear()
    const yearStart = new Date(currentYear, 0, 1)
    const yearEnd = new Date(currentYear, 11, 31)

    const [totalSpend, expenses] = await Promise.all([
      prisma.expense.aggregate({
        where: { projectId, expenseDate: { gte: yearStart, lte: yearEnd }, status: 'active' },
        _sum: { baseCurrencyAmount: true }
      }),
      prisma.expense.findMany({
        where: { projectId, status: 'active' },
        include: { category: { select: { name: true, color: true } } },
        orderBy: { expenseDate: 'desc' },
        take: 20
      })
    ])

    res.json({
      totalSpend: Number(totalSpend._sum.baseCurrencyAmount) || 0,
      expenses
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load project spend' })
  }
})

router.post('/', async (req, res) => {
  try {
    const count = await prisma.project.count()
    const project = await prisma.project.create({
      data: {
        ...req.body,
        code: req.body.code || `PRJ-${String(count + 1).padStart(3, '0')}`
      }
    })
    res.json(project)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create project' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const project = await prisma.project.update({
      where: { id: Number(req.params.id) },
      data: req.body
    })
    res.json(project)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project' })
  }
})

export default router
