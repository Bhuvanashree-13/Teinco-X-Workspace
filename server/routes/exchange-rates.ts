import { Router } from 'express'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

const router = Router()
const supportedCurrencies = new Set(['USD', 'EUR'])
const cache = new Map<string, { rate: number; date: string; expiresAt: number }>()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

router.use(requireAuth, requireAdmin)

router.get('/:currency', async (req, res) => {
  const currency = String(req.params.currency || '').toUpperCase()
  const requestedDate = String(req.query.date || new Date().toISOString().slice(0, 10))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || Number.isNaN(new Date(`${requestedDate}T00:00:00Z`).getTime())) {
    return res.status(400).json({ error: 'A valid expense date is required' })
  }
  if (currency === 'INR') return res.json({ base: 'INR', quote: 'INR', rate: 1, date: requestedDate, source: 'fixed' })
  if (!supportedCurrencies.has(currency)) return res.status(400).json({ error: 'Currency must be INR, USD, or EUR' })

  const cacheKey = `${currency}:${requestedDate}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return res.json({ base: currency, quote: 'INR', rate: cached.rate, date: cached.date, source: 'Frankfurter', cached: true })
  }

  try {
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${currency}/INR?date=${encodeURIComponent(requestedDate)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Teinco-X-Finance/1.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`Rate provider returned ${response.status}`)
    const data = await response.json() as { rate?: number; date?: string }
    const rate = Number(data.rate)
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Rate provider returned an invalid rate')
    const date = String(data.date || new Date().toISOString().slice(0, 10))
    cache.set(cacheKey, { rate, date, expiresAt: Date.now() + CACHE_TTL_MS })
    res.json({ base: currency, quote: 'INR', rate, date, source: 'Frankfurter', cached: false })
  } catch (error) {
    console.error('Exchange rate error:', error)
    res.status(503).json({ error: 'Live exchange rate is temporarily unavailable. Please try again.' })
  }
})

export default router
