import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildLedgerSignals, type EvidenceExpense } from '../server/lib/flow-intelligence.js'
const now = new Date('2026-09-07T12:00:00Z')
const row = (id: number, amount = 200, days = 5): EvidenceExpense => ({ id, expenseId: `EXP-${id}`, description: 'Test expense', expenseDate: new Date(now.getTime() - days * 86400000), baseCurrencyAmount: amount, vendorId: 1, invoiceNumber: null })
test('duplicate candidates retain invoice evidence and are not treated as confirmed errors', () => {
  const signals = buildLedgerSignals([{ ...row(1), invoiceNumber: 'INV-1' }, { ...row(2), invoiceNumber: ' inv-1 ' }], now)
  assert.equal(signals.length, 1)
  assert.equal(signals[0].evidenceCount, 2)
  assert.match(signals[0].title, /Possible/)
  assert.equal(signals[0].evidence[0].href, '/expenses?search=EXP-1')
})
test('different vendors or amounts do not match duplicate rule', () => {
  assert.deepEqual(buildLedgerSignals([{ ...row(1), invoiceNumber: 'INV' }, { ...row(2), invoiceNumber: 'INV', vendorId: 2 }, { ...row(3, 300), invoiceNumber: 'INV' }], now), [])
})
test('unassigned vendors cannot form assumed duplicate invoices', () => {
  assert.deepEqual(buildLedgerSignals([1, 2].map(id => ({ ...row(id), invoiceNumber: 'INV', vendorId: null })), now), [])
})
test('insufficient history never generates a large-expense conclusion', () => {
  assert.deepEqual(buildLedgerSignals([row(1, 1000000)], now), [])
})
test('large expenses use prior history and preserve source evidence', () => {
  const history = Array.from({ length: 10 }, (_, id) => row(id, 1000, 45))
  const signals = buildLedgerSignals([...history, row(11, 15000)], now)
  assert.equal(signals[0].id, 'large-expenses')
  assert.equal(signals[0].evidence[0].amount, 15000)
  assert.match(signals[0].method, /1000.00/)
  assert.equal(signals[0].evidenceCount, 1)
})
test('rules do not mutate source records', () => {
  const rows = [row(1), row(2)]
  const before = JSON.stringify(rows)
  buildLedgerSignals(rows, now)
  assert.equal(JSON.stringify(rows), before)
})
