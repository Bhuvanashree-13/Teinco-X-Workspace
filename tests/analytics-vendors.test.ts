import assert from 'node:assert/strict'
import { test } from 'node:test'
import { vendorBreakdownFor } from '../server/lib/analytics-vendors.js'
const row = (vendorId: number | null, expenseType: string, amount: number, count = 1) => ({ vendorId, expenseType, _sum: { baseCurrencyAmount: amount }, _count: count })
test('payroll and unassigned expenses are not invented vendors', () => {
  const result = vendorBreakdownFor([row(null, 'salary', 150000, 2), row(null, 'one_time', 11330, 6), row(1, 'recurring', 13311, 2)], [{ id: 1, name: 'Google Workspace' }])
  assert.deepEqual(result.map(item => [item.vendor, item.kind, item.amount]), [['Payroll / salaries', 'internal', 150000], ['Google Workspace', 'vendor', 13311], ['No vendor assigned', 'unassigned', 11330]])
  assert.equal(result.reduce((sum, item) => sum + item.transactions, 0), 10)
  assert.equal(result.reduce((sum, item) => sum + item.amount, 0), 174641)
})
test('vendor expenses across types aggregate by ID, not name', () => {
  const result = vendorBreakdownFor([row(1, 'one_time', 10), row(1, 'recurring', 20), row(2, 'one_time', 5)], [{ id: 1, name: 'Same name' }, { id: 2, name: 'Same name' }])
  assert.deepEqual(result.map(item => item.amount), [30, 5])
  assert.equal(result[0].transactions, 2)
})
test('missing referenced vendor retains its ID and total', () => {
  assert.equal(vendorBreakdownFor([row(999, 'one_time', 20)], [])[0].vendor, 'Unavailable vendor #999')
})
test('all vendors are retained rather than silently truncating totals at 20', () => {
  assert.equal(vendorBreakdownFor(Array.from({ length: 25 }, (_, id) => row(id + 1, 'one_time', 10)), []).length, 25)
})
