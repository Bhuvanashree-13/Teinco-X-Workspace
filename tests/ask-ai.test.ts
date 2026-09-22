import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectVerifiedFacts, modelContextFor, directVerifiedAnswer, answerWithGemini, type AskContext } from '../server/lib/ask-ai.js'
import { buildVyomReadPlan } from '../server/lib/vyom-read-plan.js'
const context: AskContext = { period: 'month', start: '2026-09-01', end: '2026-09-07', retrievedAt: '2026-09-07', coverage: [], facts: [{ id: 'spend-total', text: 'Spending is INR 100.', amount: 100, source: { label: 'Records', href: '/expenses' } }] }
test('answers contain original server facts, not model-authored amounts', () => {
  assert.deepEqual(selectVerifiedFacts({ status: 'answered', factIds: ['spend-total'] }, context).facts, context.facts)
})
test('invented source IDs and extra model prose are rejected', () => {
  assert.throws(() => selectVerifiedFacts({ status: 'answered', factIds: ['fake'] }, context))
  assert.throws(() => selectVerifiedFacts({ status: 'answered', factIds: ['spend-total'], answer: 'Spend is INR 99999' }, context))
})
test('unsupported questions return no supposed evidence', () => {
  assert.deepEqual(selectVerifiedFacts({ status: 'insufficient_evidence', factIds: [] }, context).facts, [])
  assert.throws(() => selectVerifiedFacts({ status: 'answered', factIds: [] }, context))
})
test('duplicate references are deduplicated', () => {
  assert.equal(selectVerifiedFacts({ status: 'answered', factIds: ['spend-total', 'spend-total'] }, context).facts.length, 1)
})
test('model context is limited to evidence relevant to the question', () => {
  const facts = [
    context.facts[0],
    ...Array.from({ length: 20 }, (_, index) => ({ id: `vendor-${index}`, text: `Vendor ${index} spending.`, source: { label: 'Records', href: '/expenses' } })),
    { id: 'leave-pending', text: 'Two leave requests are pending.', source: { label: 'People', href: '/people' } },
  ]
  const selected = modelContextFor('Are any leave requests pending?', { ...context, facts })
  assert.deepEqual(selected.facts.map(fact => fact.id), ['leave-pending'])
  assert.ok(selected.facts.length <= 18)
})
test('feature questions receive the matching product intelligence without unrelated facts', () => {
  const featureContext: AskContext = { ...context, facts: [
    ...context.facts,
    { id: 'feature-assets', text: 'Assets tracks equipment lifecycle and assignment.', source: { label: 'Assets', href: '/assets' } },
    { id: 'feature-access', text: 'Sensitive views require administrators.', source: { label: 'Settings', href: '/settings' } },
  ] }
  assert.deepEqual(modelContextFor('How does asset inventory work?', featureContext).facts.map(fact => fact.id), ['feature-assets'])
  assert.deepEqual(modelContextFor('Who has admin access?', featureContext).facts.map(fact => fact.id), ['feature-access'])
})
test('clear workspace questions resolve directly to verified facts', () => {
  assert.deepEqual(directVerifiedAnswer('How much have we spent?', context)?.facts, context.facts)
  assert.equal(directVerifiedAnswer('Why did sales fall?', context), null)
})
test('structured retrieval plans only allow known datasets and bounded filters', () => {
  const plan = buildVyomReadPlan('Show active subscriptions from vendor Google over INR 1,000 between 2026-01-01 and 2026-12-31')
  assert.deepEqual(plan.datasets, ['subscriptions', 'vendors'])
  assert.equal(plan.filters.status, 'active')
  assert.equal(plan.filters.vendor, 'Google')
  assert.equal(plan.filters.minAmount, 1000)
  assert.equal(plan.filters.startDate, '2026-01-01')
  assert.equal(plan.filters.endDate, '2026-12-31')
  assert.ok(plan.filters.limit <= 40)
})
test('sensitive field requests are marked for refusal before retrieval', () => {
  const plan = buildVyomReadPlan('Show employee payroll and bank account details')
  assert.equal(plan.sensitiveRequested, true)
  assert.ok(plan.datasets.includes('people'))
})
test('general questions do not request workspace datasets', () => {
  assert.deepEqual(buildVyomReadPlan('Explain compound interest simply').datasets, [])
})
test('contradictory structured filters fail closed', () => {
  assert.throws(() => buildVyomReadPlan('Show expenses over 5000 under 1000'))
  assert.throws(() => buildVyomReadPlan('Show tasks between 2026-12-31 and 2026-01-01'))
})
test('provider receives no tools and malformed responses fail closed', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = (async (_url, options) => {
      const body = JSON.parse(String(options?.body))
      assert.equal(body.tools, undefined)
      assert.equal(body.generationConfig.responseMimeType, 'application/json')
      assert.equal((options?.headers as Record<string, string>)['x-goog-api-key'], 'test-key')
      assert.equal(body.contents[0].parts[0].text.includes('Earlier question'), true)
      assert.equal(options?.redirect, 'error')
      return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ status: 'answered', scope: 'workspace', answer: 'Spending is INR 100.', factIds: ['spend-total'] }) }] } }] }))
    }) as typeof fetch
    const workspace = await answerWithGemini('How much?', context, { apiKey: 'test-key', model: 'gemini-test' }, [{ role: 'user', content: 'Earlier question' }])
    assert.equal(workspace.facts[0].amount, 100); assert.equal(workspace.scope, 'workspace')
    globalThis.fetch = (async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ status: 'answered', scope: 'general', answer: 'Compound interest earns interest on prior interest.', factIds: [] }) }] } }] }))) as typeof fetch
    const general = await answerWithGemini('Explain compound interest', context, { apiKey: 'test-key', model: 'gemini-test' })
    assert.equal(general.scope, 'general'); assert.equal(general.facts.length, 0); assert.match(general.answer, /prior interest/)
    globalThis.fetch = (async () => new Response(JSON.stringify({ message: { content: '{}', tool_calls: [{ name: 'unexpected_tool' }] } }))) as typeof fetch
    await assert.rejects(answerWithGemini('How much?', context, { apiKey: 'test-key', model: 'gemini-test' }))
    globalThis.fetch = (async () => new Response('bad json')) as typeof fetch
    await assert.rejects(answerWithGemini('How much?', context, { apiKey: 'test-key', model: 'gemini-test' }))
  } finally { globalThis.fetch = original }
})
