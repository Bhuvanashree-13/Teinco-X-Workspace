import assert from 'node:assert/strict'
import { test } from 'node:test'
import express from 'express'
import jwt from 'jsonwebtoken'
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test'
process.env.JWT_SECRET = 'attendance-test-secret'
const { prisma } = await import('../server/db.js')
const { default: employees } = await import('../server/routes/employees.js')

test('attendance requires employees, explicit actions and server-owned timestamps', async () => {
  const restore: (() => void)[] = []
  const replace = (model: any, method: string, impl: any) => { const original = model[method]; restore.push(() => { model[method] = original }); model[method] = impl }
  let role = 'employee', employeeId: number | null = 7, log: any = null, auditCount = 0
  replace(prisma.user, 'findUnique', async () => ({ id: 1, role, employeeId, isActive: true }))
  replace(prisma, '$transaction', async (fn: any) => fn(prisma))
  replace(prisma.attendanceLog, 'findUnique', async () => log)
  replace(prisma.attendanceLog, 'findUniqueOrThrow', async () => log)
  replace(prisma.attendanceLog, 'findMany', async () => log ? [log] : [])
  replace(prisma.attendanceLog, 'create', async ({ data }: any) => {
    assert.equal(data.employeeId, 7)
    assert.ok(data.checkIn instanceof Date)
    assert.match(data.checkInIst, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+05:30$/)
    assert.equal(data.timezone, 'Asia/Kolkata')
    return log = { ...data, id: 11, employee: { id: 7, name: 'Employee' }, checkOut: null }
  })
  replace(prisma.attendanceLog, 'updateMany', async ({ where, data }: any) => {
    if (where.checkOut === null && log.checkOut) return { count: 0 }
    Object.assign(log, data); return { count: 1 }
  })
  replace(prisma.attendanceLog, 'deleteMany', async ({ where }: any) => {
    assert.equal(where.employeeId, 7)
    if (!log || where.id !== log.id) return { count: 0 }
    log = null; return { count: 1 }
  })
  replace(prisma.auditLog, 'create', async () => { auditCount++; return {} })
  const app = express(); app.use(express.json()); app.use('/employees', employees)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as any).port}/employees`
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: 1 }, process.env.JWT_SECRET!)}`, 'Content-Type': 'application/json' }
  const officeLocation = { latitude: 12.9745454, longitude: 77.5990926, accuracy: 15 }
  const post = (body: any, path = '/attendance/clock') => fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) })
  try {
    assert.equal((await fetch(base + '/attendance/clock', { method: 'POST' })).status, 401)
    role = 'admin'
    assert.equal((await post({ action: 'check_in', ...officeLocation })).status, 403)
    assert.equal((await post({}, '/attendance')).status, 403)
    role = 'employee'; employeeId = null
    assert.equal((await post({ action: 'check_in' })).status, 403)
    employeeId = 7
    assert.equal((await post({}, '/attendance')).status, 403)
    assert.equal((await post({})).status, 400)
    assert.equal((await post({ action: 'check_in', employeeId: 99, ...officeLocation })).status, 400)
    assert.equal((await post({ action: 'check_in', checkIn: '2020-01-01', ...officeLocation })).status, 400)
    assert.equal((await post({ action: 'check_out', ...officeLocation })).status, 409)
    const entered = await post({ action: 'check_in' }); assert.equal(entered.status, 200)
    const payload = await entered.json()
    assert.equal(log.geoFenceStatus, 'not_required'); assert.equal(payload.log.checkedIn, true); assert.equal(payload.log.checkedOut, false)
    assert.equal(payload.log.checkIn, undefined); assert.equal(payload.log.checkOut, undefined)
    assert.equal((await post({ action: 'check_in', ...officeLocation })).status, 409)
    assert.equal(log.checkOut, null)
    assert.equal((await post({ action: 'check_out', latitude: 0, longitude: 0, accuracy: 10000 })).status, 200)
    assert.match(log.checkOutIst, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+05:30$/)
    assert.equal(log.timezone, 'Asia/Kolkata')
    assert.equal((await post({ action: 'check_out', ...officeLocation })).status, 409)
    assert.equal((await post({ action: 'check_in', ...officeLocation })).status, 409)
    assert.equal(auditCount, 2)
    const rows = await (await fetch(base + '/attendance', { headers })).json()
    assert.equal(rows[0].checkedOut, true)
    assert.equal(rows[0].checkOut, undefined)
    assert.equal((await fetch(base + '/attendance/11', { method: 'DELETE', headers })).status, 404)
    assert.equal(auditCount, 2)
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
    restore.reverse().forEach(fn => fn())
  }
})
