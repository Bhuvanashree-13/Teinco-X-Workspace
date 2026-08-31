import { Router } from 'express'
import { prisma } from '../db.js'
import { startOfYear, endOfYear } from 'date-fns'

const router = Router()

router.get('/spend-by-category', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear()
    const start = startOfYear(new Date(year, 0, 1))
    const end = endOfYear(new Date(year, 0, 1))

    const data = await prisma.expense.groupBy({
      by: ['categoryId'],
      where: { expenseDate: { gte: start, lte: end }, status: 'active' },
      _sum: { baseCurrencyAmount: true }
    })

    const categories = await prisma.expenseCategory.findMany()
    const catMap = new Map(categories.map(c => [c.id, c]))

    res.json(data.map(d => ({
      category: d.categoryId ? catMap.get(d.categoryId)?.name || 'Unknown' : 'Unknown',
      color: d.categoryId ? catMap.get(d.categoryId)?.color || '#6b7280' : '#6b7280',
      amount: Number(d._sum.baseCurrencyAmount) || 0
    })))
  } catch (error) {
    res.status(500).json({ error: 'Analytics failed' })
  }
})

router.get('/spend-by-vendor', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear()
    const start = startOfYear(new Date(year, 0, 1))
    const end = endOfYear(new Date(year, 0, 1))

    const data = await prisma.expense.groupBy({
      by: ['vendorId'],
      where: { expenseDate: { gte: start, lte: end }, status: 'active' },
      _sum: { baseCurrencyAmount: true },
      _count: true
    })

    const vendors = await prisma.vendor.findMany()
    const venMap = new Map(vendors.map(v => [v.id, v]))

    res.json(data.map(d => ({
      vendor: d.vendorId ? venMap.get(d.vendorId)?.name || 'Unknown' : 'Unknown',
      amount: Number(d._sum.baseCurrencyAmount) || 0,
      transactions: d._count
    })).sort((a: any, b: any) => b.amount - a.amount).slice(0, 20))
  } catch (error) {
    res.status(500).json({ error: 'Analytics failed' })
  }
})

router.get('/project-allocation', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear()
    const start = startOfYear(new Date(year, 0, 1))
    const end = endOfYear(new Date(year, 0, 1))

    const data = await prisma.expense.groupBy({
      by: ['projectId'],
      where: { expenseDate: { gte: start, lte: end }, status: 'active' },
      _sum: { baseCurrencyAmount: true }
    })

    const projects = await prisma.project.findMany()
    const projMap = new Map(projects.map(p => [p.id, p]))

    res.json(data.map(d => ({
      project: d.projectId ? projMap.get(d.projectId)?.name || 'Unknown' : 'Unknown',
      color: d.projectId ? projMap.get(d.projectId)?.color || '#6b7280' : '#6b7280',
      amount: Number(d._sum.baseCurrencyAmount) || 0
    })))
  } catch (error) {
    res.status(500).json({ error: 'Analytics failed' })
  }
})

export default router
