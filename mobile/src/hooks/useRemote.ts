import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { request } from '../api'
import { useAuth } from '../auth/AuthContext'
export function useRemote<T>(path: string | null) {
  const { token, serverUrl } = useAuth()
  const [data, setData] = useState<T | null>(null), [loading, setLoading] = useState(Boolean(path)), [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const load = useCallback(async () => {
    const current = ++generation.current
    if (!path) { setData(null); setError(null); setLoading(false); return }
    setLoading(true); setError(null)
    try { const result = await request<T>(serverUrl, path, token); if (current === generation.current) setData(result) }
    catch (err) { if (current === generation.current) setError(err instanceof Error ? err.message : 'Unable to load data') }
    finally { if (current === generation.current) setLoading(false) }
  }, [path, serverUrl, token])
  useEffect(() => { setData(null) }, [path, token])
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++ } }, [load]))
  return { data, loading, error, refresh: load }
}
