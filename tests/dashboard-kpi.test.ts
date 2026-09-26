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
  const originals = { user: prisma.user.findUnique, deposits: prisma.deposit.aggregate, aggregate: prisma.expense.aggregate, expenses: prisma.expense.findMany, groups: prisma.expense.groupBy, categories: prisma.expenseCategory.findMany, projects: prisma.project.findMany }
  prisma.user.findUnique = (async () => ({ id: 1, role: 'admin', isActive: true })) as any
  prisma.deposit.aggregate = (async (query: any) => {
    assert.ok(query.where.depositDate.lte instanceof Date)
    return { _sum: { baseCurrencyAmount: 1000 }, _count: 2 }
  }) as any
  prisma.expense.aggregate = (async () => ({ _sum: { baseCurrencyAmount: 0 } })) as any
  prisma.expense.findMany = (async (query: any) => {
    if (query.include) return []
    assert.equal(query.where.expenseDate, undefined)
    return [{ expenseDate: new Date(year - 1, 0, 1), baseCurrencyAmount: 400 }, { expenseDate: new Date(year, 0, 1), baseCurrencyAmount: 100 }, { expenseDate: new Date(year + 1, 0, 1), baseCurrencyAmount: 50 }]
  }) as any
  prisma.expense.groupBy = (async (query: any) => {
    assert.ok(query.where.expenseDate.lte <= new Date())
    return []
  }) as any
  prisma.expenseCategory.findMany = (async () => []) as any
  prisma.project.findMany = (async () => []) as any
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
    assert.equal(data.availableBalance, 450)
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
    prisma.project.findMany = originals.projects
    await new Promise<void>(resolve => server.close(() => resolve()))
    await prisma.$disconnect()
  }
})

test('dashboard details return the records behind a category card, including subcategories', async () => {
  const originals = { user: prisma.user.findUnique, expenses: prisma.expense.findMany, deposits: prisma.deposit.findMany, categories: prisma.expenseCategory.findMany }
  prisma.user.findUnique = (async () => ({ id: 1, role: 'admin', isActive: true })) as any
  prisma.expenseCategory.findMany = (async () => [{ id: 1, parentId: null, code: 'SOFTWARE' }, { id: 2, parentId: 1, code: 'SAAS' }, { id: 3, parentId: null, code: 'CLOUD' }]) as any
  let expenseQuery: any
  prisma.expense.findMany = (async (query: any) => {
    expenseQuery = query
    return [{ id: 7, expenseId: 'EXP-1', expenseDate: new Date(), description: 'Figma', vendor: { name: 'Figma' }, category: { name: 'SaaS', color: '#000' }, isRecurring: true, frequency: 'monthly', baseCurrencyAmount: 1200 }]
  }) as any
  prisma.deposit.findMany = (async () => { throw new Error('deposits should not load for a category card') }) as any
  const app = express()
  app.use('/dashboard', dashboard)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    const headers = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET!)}` }
    assert.equal((await fetch(`${url}/dashboard/details?metric=nope`, { headers })).status, 400)
    const res = await fetch(`${url}/dashboard/details?metric=software`, { headers })
    assert.equal(res.status, 200)
    const data = await res.json()
    assert.deepEqual(expenseQuery.where.categoryId.in.sort(), [1, 2])
    assert.ok(expenseQuery.where.expenseDate.gte instanceof Date)
    assert.equal(data.rows.length, 1)
    assert.equal(data.rows[0].amount, 1200)
    assert.equal(data.rows[0].kind, 'expense')
  } finally {
    prisma.user.findUnique = originals.user
    prisma.expense.findMany = originals.expenses
    prisma.deposit.findMany = originals.deposits
    prisma.expenseCategory.findMany = originals.categories
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
