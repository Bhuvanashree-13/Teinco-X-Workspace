import { Router } from 'express'
import { prisma } from '../db.js'
import XLSX from 'xlsx'

const router = Router()

router.post('/export', async (req, res) => {
  try {
    const { format, filters } = req.body
    const expenses = await prisma.expense.findMany({
      where: filters || { status: 'active' },
      include: {
        vendor: { select: { name: true } },
        category: { select: { name: true } },
        project: { select: { name: true } },
      }
    })

    if (format === 'json') {
      return res.json(expenses)
    }

    const data = expenses.map((e: any) => ({
      'Expense ID': e.expenseId,
      'Date': e.expenseDate.toISOString().split('T')[0],
      'Vendor': e.vendor?.name,
      'Description': e.description,
      'Category': e.category?.name,
      'Type': e.expenseType,
      'Amount (INR)': Number(e.baseCurrencyAmount),
      'Project': e.project?.name,
      'GST': Number(e.gstAmount),
      'Total': Number(e.totalAmount),
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Disposition', 'attachment; filename=expenses.xlsx')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(buf)
  } catch (error) {
    res.status(500).json({ error: 'Export failed' })
  }
})

export default router
