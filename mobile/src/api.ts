export type AuthUser = { id: number; email: string; name?: string | null; role: 'admin' | 'employee'; employeeId?: number | null }
export const normalizeServerUrl = (value: string) => value.trim().replace(/\/+$/, '').replace(/\/api$/, '')
export async function request<T>(serverUrl: string, path: string, token?: string | null, init?: RequestInit): Promise<T> {
  const response = await fetch(`${normalizeServerUrl(serverUrl)}/api${path}`, { ...init, headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers } })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`)
  return body as T
}
