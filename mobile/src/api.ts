export type AuthUser = { id: number; email: string; name?: string | null; role: 'admin' | 'employee'; employeeId?: number | null }
export const normalizeServerUrl = (value: string) => value.trim().replace(/\/+$/, '').replace(/\/api$/, '')
export async function request<T>(serverUrl: string, path: string, token?: string | null, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), path === '/flow/ask' || path === '/flow/ask/test' ? 130000 : 30000)
  try {
    const response = await fetch(`${normalizeServerUrl(serverUrl)}/api${path}`, { ...init, signal: init?.signal || controller.signal, headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers } })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(body?.error || (response.status === 401 ? 'Your session expired. Sign out and sign in again.' : `Request failed (${response.status})`))
    if (body === null) throw new Error('The server returned an unreadable response. Please retry.')
    return body as T
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The request timed out. Check your connection and try again.')
    throw error
  } finally { clearTimeout(timer) }
}
