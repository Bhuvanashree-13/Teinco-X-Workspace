import { Router } from 'express'
import { prisma } from '../db.js'
import { addMonths } from 'date-fns'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)

// Helper: Create or update the recurring expense linked to a subscription
async function syncSubscriptionExpense(sub: any) {
  const frequencyMap: Record<string, string> = {
    daily: 'daily',
    weekly: 'weekly',
    monthly: 'monthly',
    quarterly: 'quarterly',
    half_yearly: 'half_yearly',
    yearly: 'yearly',
  }

  if (sub.expenseId) {
    // Update existing expense
    return prisma.expense.update({
      where: { id: sub.expenseId },
      data: {
        description: sub.productName,
        baseCurrencyAmount: sub.cost,
        originalAmount: sub.cost,
        expenseDate: sub.startDate,
        isRecurring: true,
        frequency: frequencyMap[sub.billingCycle] || 'monthly',
        startDate: sub.startDate,
        endDate: sub.status === 'cancelled' ? new Date() : sub.endDate,
        nextDueDate: sub.nextBillingDate,
        status: sub.status === 'cancelled' ? 'archived' : 'active',
      },
    })
  } else {
    // Create new expense
    const year = new Date().getFullYear()
    const count = await prisma.expense.count({
      where: { expenseId: { startsWith: `EXP-${year}` } },
    })
    const expense = await prisma.expense.create({
      data: {
        expenseId: `EXP-${year}-${String(count + 1).padStart(6, '0')}`,
        expenseDate: sub.startDate,
        description: sub.productName,
        vendorId: sub.vendorId,
        categoryId: sub.categoryId,
        baseAmount: sub.cost,
        totalAmount: sub.cost,
        baseCurrencyAmount: sub.cost,
        originalCurrency: sub.currency,
        originalAmount: sub.cost,
        exchangeRate: 1,
        baseCurrency: sub.currency,
        isRecurring: true,
        frequency: frequencyMap[sub.billingCycle] || 'monthly',
        startDate: sub.startDate,
        nextDueDate: sub.nextBillingDate,
        businessPurpose: sub.businessPurpose,
        status: sub.status === 'cancelled' ? 'archived' : 'active',
      },
    })
    return expense
  }
}

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

router.post('/', async (req, res) => {
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
    // Create corresponding recurring expense
    const expense = await syncSubscriptionExpense(sub)
    const result = await prisma.subscription.update({
      where: { id: sub.id },
      data: { expenseId: expense.id },
      include: { vendor: true, category: true }
    })
    res.json(result)
  } catch (error) {
    console.error('Create subscription error:', error)
    res.status(500).json({ error: 'Failed to create subscription' })
  }
})

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const sub = await prisma.subscription.update({
      where: { id: Number(req.params.id) },
      data: req.body,
      include: { vendor: true, category: true }
    })
    // Sync the linked recurring expense
    if (sub.expenseId) {
      await syncSubscriptionExpense(sub)
    }
    res.json(sub)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update subscription' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const sub = await prisma.subscription.update({
      where: { id: Number(req.params.id) },
      data: { status: 'cancelled' }
    })
    // Archive the linked recurring expense
    if (sub.expenseId) {
      await prisma.expense.update({
        where: { id: sub.expenseId },
        data: { status: 'archived' }
      })
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel subscription' })
  }
})

export default router
