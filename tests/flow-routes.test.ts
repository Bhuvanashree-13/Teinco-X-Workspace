import assert from 'node:assert/strict'
import { test } from 'node:test'
import express from 'express'
import jwt from 'jsonwebtoken'
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test'
process.env.JWT_SECRET = 'flow-route-test-secret'
const { prisma } = await import('../server/db.js')
const { default: flow } = await import('../server/routes/flow.js')
test('Flow enforces roles and projects recorded spend without double counting or overriding zero', async () => {
  const restored: (() => void)[] = []
  function replace(model: any, method: string, implementation: any) { const original = model[method]; restored.push(() => { model[method] = original }); model[method] = implementation }
  let role = 'employee'
  replace(prisma.user, 'findUnique', async () => ({ id: 1, role, isActive: true }))
  replace(prisma.expense, 'aggregate', async (query: any) => {
    if (query.where.expenseDate?.lt) return { _sum: { baseCurrencyAmount: 900 }, _count: 3 }
    if (query.where.isRecurring) return { _sum: { baseCurrencyAmount: 100 } }
    return { _sum: { baseCurrencyAmount: 300 } }
  })
  replace(prisma.employee, 'aggregate', async () => ({ _sum: { monthlyCost: 500 } }))
  for (const model of [prisma.employee, prisma.leaveRequest, prisma.project, prisma.scheduleMilestone, prisma.scheduleEvent, prisma.flowAutomationRule, prisma.executiveInsight]) replace(model, 'count', async () => 0)
  replace(prisma.forecastScenario, 'findMany', async () => [{ assumedMonthlyBurn: 0, assumedMonthlyRevenue: 100, horizonMonths: 6, plannedHeadcountChange: 0 }])
  replace(prisma.expense, 'findMany', async () => [])
  const app = express(); app.use('/flow', flow)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/flow`
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET!)}` }
  try {
    assert.equal((await fetch(`${base}/intelligence`)).status, 401)
    assert.equal((await fetch(`${base}/intelligence`, { headers })).status, 403)
    role = 'admin'
    const overview = await (await fetch(`${base}/overview`, { headers })).json()
    assert.equal(overview.modules.ledger.operatingBurn, 300)
    const forecast = await (await fetch(`${base}/forecast`, { headers })).json()
    assert.equal(forecast.baseline.monthlyBurn, 300)
    assert.equal(forecast.baseline.projectedBurn, 1800)
    assert.equal(forecast.scenarios[0].assumedMonthlyBurn, 0)
    assert.equal(forecast.scenarios[0].projectedNetBurn, -600)
    const checks = await (await fetch(`${base}/intelligence`, { headers })).json()
    assert.equal(checks.anomalyCheck, 'insufficient_history')
    assert.equal(checks.recordsReviewed, 0)
    assert.deepEqual(checks.signals, [])
  } finally {
    restored.reverse().forEach(restore => restore())
    await new Promise<void>(resolve => server.close(() => resolve()))
    await prisma.$disconnect()
  }
})
