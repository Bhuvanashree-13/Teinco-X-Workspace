import assert from 'node:assert/strict'
import { test } from 'node:test'
import express from 'express'
import jwt from 'jsonwebtoken'
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test'
process.env.JWT_SECRET = 'dashboard-test-secret'
const { prisma } = await import('../server/db.js')
const { default: dashboard } = await import('../server/routes/dashboard.js')
const { default: analytics } = await import('../server/routes/analytics.js')
test('dashboard periods and net balance preserve prior-year expenses', async () => {
  const year = new Date().getFullYear()
  const originals = { user: prisma.user.findUnique, deposits: prisma.deposit.aggregate, aggregate: prisma.expense.aggregate, expenses: prisma.expense.findMany, groups: prisma.expense.groupBy, categories: prisma.expenseCategory.findMany }
  prisma.user.findUnique = (async () => ({ id: 1, role: 'admin', isActive: true })) as any
  prisma.deposit.aggregate = (async (query: any) => {
    assert.ok(query.where.depositDate.lte instanceof Date)
    return { _sum: { baseCurrencyAmount: 1000 }, _count: 2 }
  }) as any
  prisma.expense.aggregate = (async () => ({ _sum: { baseCurrencyAmount: 0 } })) as any
  prisma.expense.findMany = (async (query: any) => {
    if (query.include) return []
    assert.ok(query.where.expenseDate.lte instanceof Date)
    return [{ expenseDate: new Date(year - 1, 0, 1), baseCurrencyAmount: 400 }, { expenseDate: new Date(year, 0, 1), baseCurrencyAmount: 100 }]
  }) as any
  prisma.expense.groupBy = (async (query: any) => {
    assert.ok(query.where.expenseDate.lte <= new Date())
    return []
  }) as any
  prisma.expenseCategory.findMany = (async () => []) as any
  const app = express()
  app.use('/dashboard', dashboard)
  app.use('/analytics', analytics)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    assert.equal((await fetch(`${url}/analytics/spend-by-vendor`)).status, 401)
    const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET!)
    const res = await fetch(`${url}/dashboard/kpi`, { headers: { Authorization: `Bearer ${token}` } })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.equal(data.availableBalance, 500)
    assert.equal(data.totalExpenses, 1)
    assert.equal(data.monthlyAverage, 250)
    assert.ok(data.asOf)
  } finally {
    prisma.user.findUnique = originals.user
    prisma.deposit.aggregate = originals.deposits
    prisma.expense.aggregate = originals.aggregate
    prisma.expense.findMany = originals.expenses
    prisma.expense.groupBy = originals.groups
    prisma.expenseCategory.findMany = originals.categories
    await new Promise<void>(resolve => server.close(() => resolve()))
    await prisma.$disconnect()
  }
})
