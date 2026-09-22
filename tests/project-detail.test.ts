import assert from 'node:assert/strict'
import { test } from 'node:test'
import express from 'express'
import jwt from 'jsonwebtoken'
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test'
process.env.JWT_SECRET = 'project-detail-test'
const { prisma } = await import('../server/db.js')
const { default: projects, taskAssigneeFor } = await import('../server/routes/projects.js')
test('employee-created work items are always assigned to the creating employee', () => {
  assert.equal(taskAssigneeFor('employee', 7, 99), 7)
  assert.equal(taskAssigneeFor('employee', 7, null), 7)
  assert.equal(taskAssigneeFor('admin', 7, 99), 99)
})
test('mobile work-item detail returns the record and handles missing, invalid and unauthenticated requests', async () => {
  const originalUser = prisma.user.findUnique, originalItem = prisma.workItem.findUnique
  prisma.user.findUnique = (async () => ({ id: 1, role: 'employee', employeeId: 7, isActive: true })) as any
  prisma.workItem.findUnique = (async ({ where, include }: any) => {
    assert.ok(include.project); assert.ok(include.comments)
    return where.id === 42 ? { id: 42, summary: 'News video', status: 'done', project: { name: 'Spandana' } } : null
  }) as any
  const app = express(); app.use('/projects', projects)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}/projects/issues`
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET!)}` }
  try {
    assert.equal((await fetch(`${base}/42`)).status, 401)
    const response = await fetch(`${base}/42`, { headers })
    assert.equal(response.status, 200); assert.equal((await response.json()).status, 'done')
    assert.equal((await fetch(`${base}/43`, { headers })).status, 404)
    assert.equal((await fetch(`${base}/invalid`, { headers })).status, 400)
    assert.equal((await fetch(`${base}/0`, { headers })).status, 400)
  } finally {
    prisma.user.findUnique = originalUser; prisma.workItem.findUnique = originalItem
    await new Promise<void>(resolve => server.close(() => resolve()))
    await prisma.$disconnect()
  }
})
