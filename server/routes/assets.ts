import { Router } from 'express'
import { prisma } from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query
    const where: any = {}
    if (status && status !== 'all') where.status = status as string
    if (type && type !== 'all') where.assetType = type as string

    const assets = await prisma.asset.findMany({
      where,
      include: { vendor: { select: { name: true } } },
      orderBy: { purchaseDate: 'desc' }
    })
    res.json(assets)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load assets' })
  }
})

router.get('/summary', async (req, res) => {
  try {
    const [totalValue, byType, byStatus] = await Promise.all([
      prisma.asset.aggregate({
        _sum: { purchaseCost: true }
      }),
      prisma.asset.groupBy({
        by: ['assetType'],
        _sum: { purchaseCost: true },
        _count: true
      }),
      prisma.asset.groupBy({
        by: ['status'],
        _sum: { purchaseCost: true },
        _count: true
      })
    ])

    res.json({
      totalValue: Number(totalValue._sum.purchaseCost) || 0,
      byType: byType.map(t => ({
        type: t.assetType,
        count: t._count,
        value: Number(t._sum.purchaseCost) || 0
      })),
      byStatus: byStatus.map(s => ({
        status: s.status,
        count: s._count,
        value: Number(s._sum.purchaseCost) || 0
      }))
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load asset summary' })
  }
})

router.post('/', async (req, res) => {
  try {
    const year = new Date().getFullYear()
    const count = await prisma.asset.count({
      where: { assetId: { startsWith: `AST-${year}` } }
    })
    const asset = await prisma.asset.create({
      data: {
        ...req.body,
        assetId: `AST-${year}-${String(count + 1).padStart(6, '0')}`
      }
    })
    res.json(asset)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create asset' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const asset = await prisma.asset.update({
      where: { id: Number(req.params.id) },
      data: req.body
    })
    res.json(asset)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update asset' })
  }
})

export default router
