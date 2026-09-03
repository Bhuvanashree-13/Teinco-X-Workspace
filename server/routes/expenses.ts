import { Router } from 'express'
import { prisma } from '../db.js'
import { startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireAdmin)

// List expenses with pagination and filters
router.get('/', async (req, res) => {
  try {
    const { page = '1', limit = '25', search, categoryId, vendorId, projectId, expenseType, startDate, endDate, status = 'active' } = req.query
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { status: status as string }

    if (search) {
      where.OR = [
        { expenseId: { contains: search as string } },
        { description: { contains: search as string } },
        { notes: { contains: search as string } },
      ]
    }

    if (categoryId) where.categoryId = Number(categoryId)
    if (vendorId) where.vendorId = Number(vendorId)
    if (projectId) where.projectId = Number(projectId)
    if (expenseType) where.expenseType = expenseType as string
    if (startDate && endDate) {
      where.expenseDate = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      }
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          vendor: { select: { name: true, code: true } },
          category: { select: { name: true, color: true, code: true } },
          subcategory: { select: { name: true } },
          project: { select: { name: true, code: true } },
          costCenter: { select: { name: true, code: true } },
          paymentMethod: { select: { name: true } },
        },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: Number(limit)
      }),
      prisma.expense.count({ where })
    ])

    res.json({
      expenses: expenses.map(e => ({
        ...e,
        baseAmount: Number(e.baseAmount),
        gstAmount: Number(e.gstAmount),
        totalAmount: Number(e.totalAmount),
        originalAmount: Number(e.originalAmount),
        exchangeRate: Number(e.exchangeRate),
        baseCurrencyAmount: Number(e.baseCurrencyAmount),
      })),
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    })
  } catch (error) {
    console.error('Expenses list error:', error)
    res.status(500).json({ error: 'Failed to load expenses' })
  }
})

// Get single expense
router.get('/:id', async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        vendor: true,
        category: true,
        subcategory: true,
        project: true,
        costCenter: true,
        paymentMethod: true,
        attachments: true,
      }
    })
    if (!expense) return res.status(404).json({ error: 'Expense not found' })
    res.json(expense)
  } catch (error) {
    res.status(500).json({ error: 'Failed to load expense' })
  }
})

// Create expense
router.post('/', async (req, res) => {
  try {
    const data = req.body
    const description = String(data.description || '').trim()
    const categoryId = Number(data.categoryId)
    const baseAmount = Number(data.baseAmount) || 0
    const gstRate = Number(data.gstRate) || 0
    const originalCurrency = String(data.originalCurrency || 'INR').toUpperCase()
    const exchangeRate = originalCurrency === 'INR' ? 1 : Number(data.exchangeRate)
    const gstAmount = Math.round(baseAmount * gstRate) / 100
    const totalAmount = Math.round((baseAmount + gstAmount) * 100) / 100
    const originalAmount = totalAmount

    if (!description) return res.status(400).json({ error: 'Expense description is required' })
    if (!Number.isFinite(categoryId) || categoryId <= 0) return res.status(400).json({ error: 'Expense category is required' })
    if (totalAmount <= 0) return res.status(400).json({ error: 'Expense amount must be greater than zero' })
    if (gstRate < 0 || gstRate > 100) return res.status(400).json({ error: 'GST rate must be between 0% and 100%' })
    if (!['INR', 'USD', 'EUR'].includes(originalCurrency)) return res.status(400).json({ error: 'Currency must be INR, USD, or EUR' })
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) return res.status(400).json({ error: 'A valid INR exchange rate is required' })

    const year = new Date().getFullYear()
    const count = await prisma.expense.count({
      where: { expenseId: { startsWith: `EXP-${year}` } }
    })
    const expenseId = `EXP-${year}-${String(count + 1).padStart(6, '0')}`

    const expense = await prisma.$transaction(async tx => {
      const createdExpense = await tx.expense.create({
        data: {
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
        vendorId: data.vendorId ? Number(data.vendorId) : null,
        description,
        categoryId,
        subcategoryId: data.subcategoryId ? Number(data.subcategoryId) : null,
        expenseType: data.expenseType || 'one_time',
        baseAmount,
        gstAmount,
        gstRate,
        totalAmount,
        originalCurrency,
        originalAmount,
        exchangeRate,
        paymentMethodId: data.paymentMethodId ? Number(data.paymentMethodId) : null,
        paidBy: data.paidBy || null,
        businessPurpose: data.businessPurpose || null,
        projectId: data.projectId ? Number(data.projectId) : null,
        costCenterId: data.costCenterId ? Number(data.costCenterId) : null,
        isRecurring: Boolean(data.isRecurring),
        frequency: data.frequency || null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
        invoiceNumber: data.invoiceNumber || null,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : null,
        taxDeductible: Boolean(data.taxDeductible),
        gstInputCredit: data.gstInputCredit || 'unknown',
        isCapitalExpense: Boolean(data.isCapitalExpense),
        notes: data.notes || null,
        tags: data.tags || null,
        expenseId,
        baseCurrency: 'INR',
        baseCurrencyAmount: Math.round(originalAmount * exchangeRate * 100) / 100,
        status: 'active'
        },
        include: {
          vendor: { select: { name: true } },
          category: { select: { name: true, color: true } },
        }
      })

      // Keep the audit payload compact. This column is a bounded string in
      // existing databases, so serializing the full Prisma record can fail
      // after the expense has already been inserted.
      await tx.auditLog.create({
        data: {
          action: 'create',
          entityType: 'expense',
          entityId: createdExpense.expenseId,
          expenseId: createdExpense.id,
          newValue: JSON.stringify({
            expenseId: createdExpense.expenseId,
            amount: Number(createdExpense.baseCurrencyAmount),
            status: createdExpense.status,
          }),
        }
      })

      return createdExpense
    })

    res.json(expense)
  } catch (error) {
    console.error('Create expense error:', error)
    res.status(500).json({ error: 'Failed to create expense' })
  }
})

// Update expense
router.put('/:id', async (req, res) => {
  try {
    const expense = await prisma.expense.update({
      where: { id: Number(req.params.id) },
      data: req.body,
      include: {
        vendor: { select: { name: true } },
        category: { select: { name: true, color: true } },
      }
    })

    await prisma.auditLog.create({
      data: {
        action: 'update',
        entityType: 'expense',
        entityId: expense.expenseId,
        newValue: JSON.stringify(expense),
      }
    })

    res.json(expense)
  } catch (error) {
    res.status(500).json({ error: 'Failed to update expense' })
  }
})

// Delete expense (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const expense = await prisma.expense.update({
      where: { id: Number(req.params.id) },
      data: { status: 'deleted' }
    })

    await prisma.auditLog.create({
      data: {
        action: 'delete',
        entityType: 'expense',
        entityId: expense.expenseId,
        previousValue: JSON.stringify(expense),
      }
    })

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete expense' })
  }
})

export default router
