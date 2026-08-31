import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type WorkspaceRole = 'admin' | 'employee'

export type AuthUser = {
  id: number
  email: string
  name?: string | null
  role: WorkspaceRole
  employeeId?: number | null
}

type LoginInput = {
  email: string
  password: string
}

type RoleContextValue = {
  user: AuthUser | null
  token: string | null
  role: WorkspaceRole
  isAdmin: boolean
  loading: boolean
  login: (input: LoginInput) => Promise<void>
  logout: () => void
}

const RoleContext = createContext<RoleContextValue | null>(null)
const TOKEN_KEY = 'teinco-x-token'
const USER_KEY = 'teinco-x-user'

const parseStoredUser = (): AuthUser | null => {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(USER_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored)
  } catch {
    window.localStorage.removeItem(USER_KEY)
    return null
  }
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => (
    typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY)
  ))
  const [user, setUser] = useState<AuthUser | null>(parseStoredUser)
  const [loading, setLoading] = useState(Boolean(token))

  const storeSession = (nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken)
    setUser(nextUser)
    window.localStorage.setItem(TOKEN_KEY, nextToken)
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    window.localStorage.removeItem(TOKEN_KEY)
    window.localStorage.removeItem(USER_KEY)
    window.localStorage.removeItem('teinco-x-role')
  }

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const res = await fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Session expired')
        const json = await res.json()
        storeSession(token, json.user)
      } catch {
        logout()
      } finally {
        setLoading(false)
      }
    }
    verify()
  }, [token])

  const login = async ({ email, password }: LoginInput) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.error || 'Login failed')
    storeSession(json.token, json.user)
  }

  const role = user?.role || 'employee'
  const value = useMemo(() => ({
    user,
    token,
    role,
    isAdmin: role === 'admin',
    loading,
    login,
    logout,
  }), [user, token, role, loading])

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  const value = useContext(RoleContext)
  if (!value) throw new Error('useRole must be used inside RoleProvider')
  return value
}
