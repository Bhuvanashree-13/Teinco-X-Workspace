import { Router } from 'express'
import { prisma } from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { search, isActive = 'true' } = req.query
    const where: any = {}
    if (isActive !== 'all') where.isActive = isActive === 'true'
    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { code: { contains: search as string } },
        { email: { contains: search as string } },
      ]
    }

    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { expenses: true, subscriptions: true } }
      }
    })
    res.json(vendors)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load vendors' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        expenses: {
          where: { status: 'active' },
          orderBy: { expenseDate: 'desc' },
          take: 20,
          include: { category: { select: { name: true, color: true } } }
        },
        subscriptions: {
          where: { status: 'active' },
          orderBy: { nextBillingDate: 'asc' }
        }
      }
    })
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' })

    // Calculate spend stats
    const currentYear = new Date().getFullYear()
    const yearStart = new Date(currentYear, 0, 1)
    const yearEnd = new Date(currentYear, 11, 31)
    const prevYearStart = new Date(currentYear - 1, 0, 1)
    const prevYearEnd = new Date(currentYear - 1, 11, 31)

    const [currentYearSpend, prevYearSpend] = await Promise.all([
      prisma.expense.aggregate({
        where: { vendorId: vendor.id, expenseDate: { gte: yearStart, lte: yearEnd }, status: 'active' },
        _sum: { baseCurrencyAmount: true }
      }),
      prisma.expense.aggregate({
        where: { vendorId: vendor.id, expenseDate: { gte: prevYearStart, lte: prevYearEnd }, status: 'active' },
        _sum: { baseCurrencyAmount: true }
      })
    ])

    res.json({
      ...vendor,
      currentYearSpend: Number(currentYearSpend._sum.baseCurrencyAmount) || 0,
      previousYearSpend: Number(prevYearSpend._sum.baseCurrencyAmount) || 0,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load vendor' })
  }
})

router.post('/', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    if (!name) return res.status(400).json({ error: 'Vendor name is required' })

    const count = await prisma.vendor.count()
    const vendor = await prisma.vendor.create({
      data: {
        name,
        type: req.body.type || 'service',
        contactName: req.body.contactName || null,
        email: req.body.email || null,
        phone: req.body.phone || null,
        website: req.body.website || null,
        gstin: req.body.gstin || null,
        pan: req.body.pan || null,
        country: req.body.country || 'India',
        currency: req.body.currency || 'INR',
        address: req.body.address || null,
        city: req.body.city || null,
        state: req.body.state || null,
        postalCode: req.body.postalCode || null,
        notes: req.body.notes || null,
        isActive: true,
        code: `VEN-${String(count + 1).padStart(6, '0')}`
      }
    })
    res.json(vendor)
  } catch (error) {
    res.status(500).json({ error: 'Failed to create vendor' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const vendor = await prisma.vendor.update({
      where: { id: Number(req.params.id) },
      data: req.body
    })
    res.json(vendor)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update vendor' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await prisma.vendor.update({
      where: { id: Number(req.params.id) },
      data: { isActive: false }
    })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete vendor' })
  }
})

export default router
