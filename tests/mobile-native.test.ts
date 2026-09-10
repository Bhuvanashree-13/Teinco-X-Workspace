import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { allowedModule, canWrite, dateKey, formPayload, initialValues, moduleById, modules, sourceRoute, type Row } from '../mobile/src/native/domain.js'
import { request } from '../mobile/src/api.js'
import { isNewerVersion } from '../mobile/src/update-version.js'
const valuesFor = (id: string, extra: Row) => ({ ...initialValues(moduleById(id).fields), ...extra })
const expense = { description: 'Cloud service', baseAmount: '123.45', categoryId: '5', gstRate: '18', originalCurrency: 'INR', expenseDate: '2026-09-08', invoiceNumber: 'INV-07' }
test('Android update comparison accepts newer semantic versions only', () => {
  assert.equal(isNewerVersion('2.0.3', '2.0.2'), true)
  assert.equal(isNewerVersion('v2.1.0', '2.0.9'), true)
  assert.equal(isNewerVersion('2.0.3', '2.0.3'), false)
  assert.equal(isNewerVersion('2.0.2', '2.0.3'), false)
})
test('employees cannot open finance or intelligence modules or edit shared subscriptions', () => {
  for (const module of modules.filter(item => item.admin)) assert.equal(allowedModule(module.id, 'employee'), false)
  for (const id of ['employees', 'leave', 'attendance', 'balances', 'payslips', 'events', 'milestones', 'subscriptions']) assert.equal(allowedModule(id, 'employee'), true)
  assert.equal(canWrite(moduleById('subscriptions'), 'employee'), false)
  assert.equal(canWrite(moduleById('leave'), 'employee'), true)
})
test('expense form emits only editable API fields and preserves decimal values and invoice details', () => {
  const fields = moduleById('expenses').fields
  const payload = formPayload(fields, valuesFor('expenses', { ...expense, id: 'wrong', vendor: { name: 'Nested' }, status: 'deleted', exchangeRate: '999' }), 'admin')
  assert.equal(payload.baseAmount, 123.45)
  assert.equal(payload.gstRate, 18)
  assert.equal(payload.exchangeRate, 1)
  assert.equal(payload.invoiceNumber, 'INV-07')
  assert.equal(payload.categoryId, 5)
  assert.equal(payload.id, undefined)
  assert.equal(payload.vendor, undefined)
  assert.equal(payload.status, undefined)
})
test('invalid amounts, GST, lookup IDs and exchange rates fail before any request', () => {
  const fields = moduleById('expenses').fields
  for (const update of [{ baseAmount: '0' }, { baseAmount: '-1' }, { baseAmount: 'Infinity' }, { baseAmount: '' }, { gstRate: '101' }, { categoryId: '5.5' }, { categoryId: '' }, { originalCurrency: 'USD', exchangeRate: '0' }]) assert.throws(() => formPayload(fields, valuesFor('expenses', { ...expense, ...update }), 'admin'))
})
test('foreign deposits retain currency and conversion rate and validate source', () => {
  const fields = moduleById('deposits').fields, input = valuesFor('deposits', { source: ' Customer ', originalAmount: '75.25', originalCurrency: 'USD', exchangeRate: '83.5' })
  const payload = formPayload(fields, input, 'admin')
  assert.equal(payload.source, 'Customer'); assert.equal(payload.originalAmount, 75.25); assert.equal(payload.exchangeRate, 83.5)
  assert.throws(() => formPayload(fields, { ...input, source: ' ' }, 'admin'))
})
test('date fields keep the chosen calendar date and reject impossible dates', () => {
  const field = [{ key: 'day', label: 'Day', type: 'date' as const, required: true }]
  const result = formPayload(field, { day: '2026-09-08' }, 'admin')
  assert.equal(dateKey(new Date(result.day)), '2026-09-08')
  assert.throws(() => formPayload(field, { day: '2026-02-31' }, 'admin'))
})
test('leave requests reject reversed dates and excess days and cannot spoof an employee', () => {
  const fields = moduleById('leave').fields, values = valuesFor('leave', { employeeId: '999', startDate: '2026-09-08', endDate: '2026-09-09', days: '1.5', reason: 'Personal' })
  assert.equal(formPayload(fields, values, 'employee').employeeId, undefined)
  assert.throws(() => formPayload(fields, { ...values, endDate: '2026-09-07' }, 'employee'))
  assert.throws(() => formPayload(fields, { ...values, days: '3' }, 'employee'))
})
test('attendance validates duration and check-out order', () => {
  const fields = moduleById('attendance').fields, values = valuesFor('attendance', { regularHours: '20', overtimeHours: '5' })
  assert.throws(() => formPayload(fields, values, 'employee'))
  assert.throws(() => formPayload(fields, { ...values, regularHours: '8', checkIn: '2026-09-08T10:00:00Z', checkOut: '2026-09-08T09:00:00Z' }, 'employee'))
})
test('editing a vendor does not include relations, generated IDs or timestamps', () => {
  const fields = moduleById('vendors').fields, original = { id: 1, code: 'VEN-01', name: 'Vendor', type: 'service', email: 'TEST@EXAMPLE.COM', currency: 'INR', country: 'India', expenses: [{ id: 4 }] }
  const payload = formPayload(fields, initialValues(fields, original), 'admin')
  assert.equal(payload.name, 'Vendor'); assert.equal(payload.email, 'test@example.com'); assert.equal(payload.expenses, undefined); assert.equal(payload.code, undefined)
})
test('false toggles and zero payroll values survive serialization', () => {
  const fields = moduleById('subscriptions').fields
  const payload = formPayload(fields, valuesFor('subscriptions', { productName: 'Service', cost: '49.99', categoryId: '3', autoRenewal: false }), 'admin')
  assert.equal(payload.autoRenewal, false); assert.equal(payload.cost, 49.99)
  const payroll = formPayload(moduleById('payroll').fields, valuesFor('payroll', {}), 'admin')
  assert.equal(payroll.bonuses, 0); assert.equal(payroll.deductions, 0)
})
test('evidence links resolve to native records and reject external URLs', () => {
  assert.deepEqual(sourceRoute('/expenses?search=EXP-1'), { module: 'expenses', query: 'search=EXP-1' })
  assert.deepEqual(sourceRoute('/deposits?startDate=2026-09-01'), { module: 'deposits', query: 'startDate=2026-09-01' })
  for (const href of ['https://example.com/expenses', '//attacker.test/expenses', 'javascript:alert(1)', '/unknown']) assert.equal(sourceRoute(href), null)
})
test('native requests carry credentials in headers and preserve API errors', async () => {
  const original = global.fetch
  try {
    global.fetch = (async (url, init) => {
      assert.equal(url, 'https://workspace.test/api/deposits')
      assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer sample-token')
      assert.ok(init?.signal)
      return new Response(JSON.stringify({ error: 'Source is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    await assert.rejects(request('https://workspace.test/', '/deposits', 'sample-token', { method: 'POST', body: '{}' }), /Source is required/)
  } finally { global.fetch = original }
})
test('production mobile UI contains no embedded browser or web session injection', () => {
  const pkg = JSON.parse(readFileSync('mobile/package.json', 'utf8'))
  assert.equal(pkg.dependencies['react-native-webview'], undefined)
  function sources(folder: string): string[] { return readdirSync(folder, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? sources(join(folder, entry.name)) : /\.tsx?$/.test(entry.name) ? [readFileSync(join(folder, entry.name), 'utf8')] : []) }
  for (const source of sources('mobile/src')) assert.doesNotMatch(source, /react-native-webview|injectedJavaScript|<WebView/)
})
