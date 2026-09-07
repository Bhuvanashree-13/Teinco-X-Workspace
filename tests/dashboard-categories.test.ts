import assert from 'node:assert/strict'
import { test } from 'node:test'
import { categoryBreakdownFor } from '../server/lib/dashboard-categories.js'
const categories = [
  { id: 1, parentId: null, name: 'People', code: 'PEOPLE', color: '#123456' },
  { id: 2, parentId: 1, name: 'Salaries', code: 'SALARIES', color: '#abcdef' },
  { id: 3, parentId: 2, name: 'Engineering', code: 'ENG', color: '#abcdef' },
  { id: 4, parentId: null, name: 'Archived tools', code: 'TOOLS', color: '#abcdef', isActive: false },
]
const spend = (categoryId: number, amount: number) => ({ categoryId, _sum: { baseCurrencyAmount: amount } })
test('parent, child and nested spending combine without duplicate totals', () => {
  const result = categoryBreakdownFor([spend(1, 100), spend(2, 150000), spend(3, 747)], categories)
  assert.deepEqual(result, [{ categoryId: 1, category: 'People', code: 'PEOPLE', color: '#123456', amount: 150847 }])
})
test('inactive historical categories retain their names', () => {
  assert.equal(categoryBreakdownFor([spend(4, 20)], categories)[0].category, 'Archived tools')
})
test('truly missing categories share one uncategorized bucket and preserve totals', () => {
  const result = categoryBreakdownFor([spend(90, 5), spend(91, 8), spend(1, 20)], categories)
  assert.deepEqual(result.map(row => [row.category, row.amount]), [['People', 20], ['Uncategorized', 13]])
})
test('missing parent keeps the known child name', () => {
  assert.equal(categoryBreakdownFor([spend(2, 10)], [categories[1]])[0].category, 'Salaries')
})
test('empty input returns no rows', () => {
  assert.deepEqual(categoryBreakdownFor([], categories), [])
})
test('negative adjustments are included in category totals', () => {
  assert.equal(categoryBreakdownFor([spend(1, 100), spend(2, -20)], categories)[0].amount, 80)
})
