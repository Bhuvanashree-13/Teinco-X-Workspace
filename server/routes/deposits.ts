import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAdmin, requireAuth, type AuthedRequest } from '../middleware/auth.js'

const router = Router()
const supportedCurrencies = new Set(['INR', 'USD', 'EUR'])

router.use(requireAuth, requireAdmin)

router.get('/', async (_req, res) => {
  try {
    const deposits = await prisma.deposit.findMany({
      where: { status: 'received' },
      orderBy: [{ depositDate: 'desc' }, { id: 'desc' }],
      take: 250,
    })
    const total = await prisma.deposit.aggregate({
      where: { status: 'received' },
      _sum: { baseCurrencyAmount: true },
    })
    res.json({
      deposits: deposits.map(item => ({
        ...item,
        originalAmount: Number(item.originalAmount),
        exchangeRate: Number(item.exchangeRate),
        baseCurrencyAmount: Number(item.baseCurrencyAmount),
      })),
      totalReceived: Number(total._sum.baseCurrencyAmount) || 0,
    })
  } catch (error) {
    console.error('Deposits list error:', error)
    res.status(500).json({ error: 'Failed to load deposits' })
  }
})

router.post('/', async (req: AuthedRequest, res) => {
  try {
    const data = req.body
    const source = String(data.source || '').trim()
    const originalCurrency = String(data.originalCurrency || 'INR').toUpperCase()
    const originalAmount = Number(data.originalAmount)
    const exchangeRate = originalCurrency === 'INR' ? 1 : Number(data.exchangeRate)

    if (!source) return res.status(400).json({ error: 'Deposit source is required' })
    if (!supportedCurrencies.has(originalCurrency)) return res.status(400).json({ error: 'Currency must be INR, USD, or EUR' })
    if (!Number.isFinite(originalAmount) || originalAmount <= 0) return res.status(400).json({ error: 'Deposit amount must be greater than zero' })
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return res.status(400).json({ error: 'A valid INR exchange rate is required' })

    const year = new Date().getFullYear()
    const count = await prisma.deposit.count({ where: { depositId: { startsWith: `DEP-${year}` } } })
    const depositId = `DEP-${year}-${String(count + 1).padStart(6, '0')}`
    const baseCurrencyAmount = Math.round(originalAmount * exchangeRate * 100) / 100
    const deposit = await prisma.deposit.create({
      data: {
        depositId,
        depositDate: data.depositDate ? new Date(data.depositDate) : new Date(),
        source,
        description: String(data.description || '').trim() || null,
        originalCurrency,
        originalAmount,
        exchangeRate,
        baseCurrency: 'INR',
        baseCurrencyAmount,
        referenceNumber: String(data.referenceNumber || '').trim() || null,
        paymentMethod: String(data.paymentMethod || '').trim() || null,
        createdById: req.user?.userId || null,
      },
    })
    res.status(201).json({ ...deposit, baseCurrencyAmount })
  } catch (error) {
    console.error('Create deposit error:', error)
    res.status(500).json({ error: 'Failed to create deposit' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const data = req.body
    const source = String(data.source || '').trim()
    const originalCurrency = String(data.originalCurrency || 'INR').toUpperCase()
    const originalAmount = Number(data.originalAmount)
    const exchangeRate = originalCurrency === 'INR' ? 1 : Number(data.exchangeRate)

    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid deposit' })
    if (!source) return res.status(400).json({ error: 'Deposit source is required' })
    if (!supportedCurrencies.has(originalCurrency)) return res.status(400).json({ error: 'Currency must be INR, USD, or EUR' })
    if (!Number.isFinite(originalAmount) || originalAmount <= 0) return res.status(400).json({ error: 'Deposit amount must be greater than zero' })
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return res.status(400).json({ error: 'A valid INR exchange rate is required' })

    const existing = await prisma.deposit.findUnique({ where: { id } })
    if (!existing || existing.status !== 'received') return res.status(404).json({ error: 'Deposit not found' })

    const baseCurrencyAmount = Math.round(originalAmount * exchangeRate * 100) / 100
    const deposit = await prisma.deposit.update({
      where: { id },
      data: {
        depositDate: data.depositDate ? new Date(data.depositDate) : existing.depositDate,
        source,
        description: String(data.description || '').trim() || null,
        originalCurrency,
        originalAmount,
        exchangeRate,
        baseCurrency: 'INR',
        baseCurrencyAmount,
        referenceNumber: String(data.referenceNumber || '').trim() || null,
        paymentMethod: String(data.paymentMethod || '').trim() || null,
      },
    })
    res.json({ ...deposit, baseCurrencyAmount })
  } catch (error) {
    console.error('Update deposit error:', error)
    res.status(500).json({ error: 'Failed to update deposit' })
  }
})

export default router
