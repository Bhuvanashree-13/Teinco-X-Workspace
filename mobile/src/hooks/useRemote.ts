import { useCallback, useEffect, useState } from 'react'
import { request } from '../api'
import { useAuth } from '../auth/AuthContext'
export function useRemote<T>(path: string) {
  const { token, serverUrl } = useAuth(); const [data, setData] = useState<T | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { try { setError(null); setData(await request<T>(serverUrl, path, token)) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load data') } finally { setLoading(false) } }, [path, serverUrl, token])
  useEffect(() => { setLoading(true); void load() }, [load]); return { data, loading, error, refresh: load }
}
