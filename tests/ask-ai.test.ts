import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectVerifiedFacts, answerWithOllama, type AskContext } from '../server/lib/ask-ai.js'
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
test('provider receives no tools and malformed responses fail closed', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = (async (_url, options) => {
      const body = JSON.parse(String(options?.body))
      assert.equal(body.tools, undefined)
      assert.equal(body.stream, false)
      assert.equal(options?.redirect, 'error')
      return new Response(JSON.stringify({ message: { content: JSON.stringify({ status: 'answered', factIds: ['spend-total'] }) } }))
    }) as typeof fetch
    assert.equal((await answerWithOllama('How much?', context, { url: 'https://example.com/api/chat', model: 'test' })).facts[0].amount, 100)
    globalThis.fetch = (async () => new Response(JSON.stringify({ message: { content: '{}', tool_calls: [{ name: 'unexpected_tool' }] } }))) as typeof fetch
    await assert.rejects(answerWithOllama('How much?', context, { url: 'https://example.com/api/chat', model: 'test' }))
    globalThis.fetch = (async () => new Response('bad json')) as typeof fetch
    await assert.rejects(answerWithOllama('How much?', context, { url: 'https://example.com/api/chat', model: 'test' }))
  } finally { globalThis.fetch = original }
})
