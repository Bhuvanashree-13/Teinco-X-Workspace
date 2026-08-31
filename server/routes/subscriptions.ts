import { Router } from 'express'
import { prisma } from '../db.js'
import { addMonths } from 'date-fns'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)

router.get('/', async (req, res) => {
  try {
    const { status = 'active', upcoming } = req.query
    const where: any = {}
    if (status !== 'all') where.status = status as string
    if (upcoming === 'true') {
      const thirtyDays = new Date()
      thirtyDays.setDate(thirtyDays.getDate() + 30)
      where.nextBillingDate = { gte: new Date(), lte: thirtyDays }
    }

    const subs = await prisma.subscription.findMany({
      where,
      include: {
        vendor: { select: { name: true, code: true } },
        category: { select: { name: true, code: true, color: true, parent: { select: { name: true } } } },
      },
      orderBy: { nextBillingDate: 'asc' }
    })
    res.json(subs)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load subscriptions' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: Number(req.params.id) },
      include: { vendor: true, category: { include: { parent: { select: { name: true } } } } }
    })
    if (!sub) return res.status(404).json({ error: 'Subscription not found' })
    res.json(sub)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load subscription' })
  }
})

router.post('/', requireAdmin, async (req, res) => {
  try {
    const year = new Date().getFullYear()
    const count = await prisma.subscription.count({
      where: { subscriptionId: { startsWith: `SUB-${year}` } }
    })
    const data = req.body
    const productName = String(data.productName || '').trim()
    const cost = Number(data.cost) || 0
    const startDate = data.startDate ? new Date(data.startDate) : new Date()
    const billingCycle = data.billingCycle || 'monthly'
    const nextBillingDate = data.nextBillingDate
      ? new Date(data.nextBillingDate)
      : addMonths(startDate, billingCycle === 'yearly' ? 12 : billingCycle === 'quarterly' ? 3 : billingCycle === 'half_yearly' ? 6 : 1)

    if (!productName) return res.status(400).json({ error: 'Subscription name is required' })
    if (cost <= 0) return res.status(400).json({ error: 'Subscription cost must be greater than zero' })

    const categoryId = Number(data.categoryId)

    if (!Number.isFinite(categoryId) || categoryId <= 0) return res.status(400).json({ error: 'Subscription category is required' })

    const sub = await prisma.subscription.create({
      data: {
        vendorId: data.vendorId ? Number(data.vendorId) : null,
        productName,
        categoryId,
        cost,
        currency: data.currency || 'INR',
        billingCycle,
        startDate,
        renewalDate: data.renewalDate ? new Date(data.renewalDate) : null,
        nextBillingDate,
        autoRenewal: data.autoRenewal ?? true,
        paymentMethodId: data.paymentMethodId ? Number(data.paymentMethodId) : null,
        owner: data.owner || null,
        businessPurpose: data.businessPurpose || null,
        status: data.status || 'active',
        notes: data.notes || null,
        isArchived: false,
        subscriptionId: `SUB-${year}-${String(count + 1).padStart(6, '0')}`,
      }
    })
    res.json(sub)
  } catch (error) {
    console.error('Create subscription error:', error)
    res.status(500).json({ error: 'Failed to create subscription' })
  }
})

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const sub = await prisma.subscription.update({
      where: { id: Number(req.params.id) },
      data: req.body
    })
    res.json(sub)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subscription' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.subscription.update({
      where: { id: Number(req.params.id) },
      data: { status: 'cancelled' }
    })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel subscription' })
  }
})

export default router
