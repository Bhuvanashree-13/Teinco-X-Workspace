import assert from 'node:assert/strict'
import { test } from 'node:test'
import express from 'express'
import jwt from 'jsonwebtoken'
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test'
process.env.JWT_SECRET = 'ask-route-test-secret'
delete process.env.VYOM_OLLAMA_URL
delete process.env.ASK_AI_MODEL
const { prisma } = await import('../server/db.js')
const { default: flow } = await import('../server/routes/flow.js')
// Prisma may load the local .env during import. Keep disabled-config tests isolated.
delete process.env.VYOM_OLLAMA_URL
delete process.env.ASK_AI_MODEL
test('Vyom blocks employees before retrieval and reconciles evidence with database aggregates', async () => {
  const restorations: (() => void)[] = []
  function replace(model: any, method: string, fn: any) { const original = model[method]; restorations.push(() => { model[method] = original }); model[method] = fn }
  let role = 'employee'
  let reads = 0
  replace(prisma.user, 'findUnique', async () => ({ id: 1, role, isActive: true }))
  replace(prisma, '$transaction', async (retrieve: any) => retrieve(prisma))
  replace(prisma.expense, 'aggregate', async () => { reads++; return { _sum: { baseCurrencyAmount: 300 }, _count: 2 } })
  replace(prisma.deposit, 'aggregate', async () => ({ _sum: { baseCurrencyAmount: 500 }, _count: 1 }))
  replace(prisma.expense, 'groupBy', async (query: any) => query.by.includes('categoryId') ? [{ categoryId: 1, _sum: { baseCurrencyAmount: 300 } }] : [{ vendorId: 1, expenseType: 'one_time', _sum: { baseCurrencyAmount: 300 }, _count: 2 }])
  replace(prisma.expenseCategory, 'findMany', async () => [{ id: 1, parentId: null, name: 'Software', code: 'SOFTWARE', color: '#fff' }])
  replace(prisma.vendor, 'findMany', async () => [{ id: 1, name: 'Test vendor' }])
  replace(prisma.expense, 'findMany', async () => [{ expenseId: 'EXP-1', baseCurrencyAmount: 300, expenseDate: new Date() }])
  replace(prisma.employee, 'count', async () => 8)
  replace(prisma.leaveRequest, 'count', async () => 2)
  replace(prisma.attendanceLog, 'count', async () => 6)
  replace(prisma.workItem, 'count', async (query: any) => query.where.status === 'blocked' ? 1 : 4)
  replace(prisma.scheduleEvent, 'findMany', async () => [{ eventId: 'EVT-1', title: 'Weekly review', startsAt: new Date(), participantsFrom: 'Finance', participantsTo: 'Leadership', purpose: 'Review spending' }])
  replace(prisma.scheduleMilestone, 'count', async () => 3)
  replace(prisma.executiveInsight, 'count', async () => 1)
  replace(prisma.subscription, 'count', async () => 5)
  const app = express(); app.use(express.json()); app.use('/flow', flow)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/flow/ask`
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET!)}`, 'Content-Type': 'application/json' }
  try {
    assert.equal((await fetch(`${base}/context?period=month`)).status, 401)
    assert.equal((await fetch(`${base}/context?period=month`, { headers })).status, 403)
    assert.equal((await fetch(`${base}/test`, { method: 'POST', headers, body: '{}' })).status, 403)
    assert.equal(reads, 0)
    role = 'admin'
    const config = await (await fetch(`${base}/config`, { headers })).json()
    assert.equal(config.enabled, false)
    assert.equal(config.model, null)
    assert.equal((await fetch(`${base}/test`, { method: 'POST', headers, body: '{}' })).status, 503)
    assert.equal((await fetch(base, { method: 'POST', headers, body: JSON.stringify({ period: 'month', question: 'How much did we spend?' }) })).status, 503)
    assert.equal(reads, 0)
    assert.equal((await fetch(`${base}/context?period=arbitrary`, { headers })).status, 400)
    const response = await fetch(`${base}/context?period=month`, { headers })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const data = await response.json()
    assert.equal(data.facts.find((fact: any) => fact.id === 'spend-total').amount, 300)
    assert.equal(data.facts.find((fact: any) => fact.id === 'period-net').amount, 200)
    assert.equal(data.facts.find((fact: any) => fact.id === 'category-0').amount, 300)
    assert.equal(data.facts.find((fact: any) => fact.id === 'vendor-0').amount, 300)
    assert.ok(data.facts.find((fact: any) => fact.id === 'deposit-total').source.href.includes('startDate='))
    assert.equal(data.facts.find((fact: any) => fact.id === 'people-active').count, 8)
    assert.equal(data.facts.find((fact: any) => fact.id === 'tasks-blocked').count, 1)
    assert.ok(data.facts.find((fact: any) => fact.id === 'event-0').text.includes('Weekly review'))
    assert.equal((await fetch(base, { method: 'POST', headers, body: JSON.stringify({ period: 'month', question: 'How much?', userId: 2 }) })).status, 400)
  } finally {
    restorations.reverse().forEach(restore => restore())
    await new Promise<void>(resolve => server.close(() => resolve()))
    await prisma.$disconnect()
  }
})
