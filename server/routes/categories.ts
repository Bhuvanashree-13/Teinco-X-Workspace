import { Router } from 'express'
import { prisma } from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { includeInactive } = req.query
    const where: any = {}
    if (includeInactive !== 'true') {
      where.isActive = true
      where.isArchived = false
    }

    const categories = await prisma.expenseCategory.findMany({
      where,
      include: {
        children: {
          where: includeInactive !== 'true' ? { isActive: true, isArchived: false } : {},
          orderBy: { sortOrder: 'asc' }
        },
        parent: { select: { name: true, id: true } }
      },
      orderBy: { sortOrder: 'asc' }
    })
    res.json(categories)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load categories' })
  }
})

router.post('/', async (req, res) => {
  try {
    const category = await prisma.expenseCategory.create({ data: req.body })
    res.json(category)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create category' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const category = await prisma.expenseCategory.update({
      where: { id: Number(req.params.id) },
      data: req.body
    })
    res.json(category)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await prisma.expenseCategory.update({
      where: { id: Number(req.params.id) },
      data: { isArchived: true, isActive: false }
    })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to archive category' })
  }
})

export default router
