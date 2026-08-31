import { useState, useEffect, useCallback } from 'react'

export { formatCurrency, formatDate } from '../lib/utils'

const API_BASE = '/api'

const addAuthHeaders = (headers?: HeadersInit) => {
  const nextHeaders = new Headers(headers)
  const token = typeof window === 'undefined' ? null : window.localStorage.getItem('teinco-x-token')
  if (token) nextHeaders.set('Authorization', `Bearer ${token}`)
  return nextHeaders
}

export function useApi<T = any>(endpoint: string | null, options?: RequestInit) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!endpoint) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: addAuthHeaders(options?.headers),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => null)
        throw new Error(error?.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export async function apiPost(endpoint: string, body: any) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: addAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const error = await res.json().catch(() => null)
    throw new Error(error?.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function apiPut(endpoint: string, body: any) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: addAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const error = await res.json().catch(() => null)
    throw new Error(error?.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function apiDelete(endpoint: string) {
  const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE', headers: addAuthHeaders() })
  if (!res.ok) {
    const error = await res.json().catch(() => null)
    throw new Error(error?.error || `HTTP ${res.status}`)
  }
  return res.json()
}
