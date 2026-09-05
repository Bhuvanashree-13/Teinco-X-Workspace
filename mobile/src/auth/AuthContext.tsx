import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import * as Keychain from 'react-native-keychain'
import { AuthUser, normalizeServerUrl, request } from '../api'
const TOKEN_KEY = 'teinco.mobile.token', USER_KEY = 'teinco.mobile.user'
const TOKEN_SERVICE = TOKEN_KEY, USER_SERVICE = USER_KEY
const defaultServer = normalizeServerUrl('https://teinco-x-workspace-production.up.railway.app')
type AuthValue = { user: AuthUser | null; token: string | null; serverUrl: string; restoring: boolean; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null), [token, setToken] = useState<string | null>(null), [restoring, setRestoring] = useState(true)
  useEffect(() => { void (async () => {
    const [savedToken, savedUser] = await Promise.all([Keychain.getGenericPassword({ service: TOKEN_SERVICE }), Keychain.getGenericPassword({ service: USER_SERVICE })])
    if (savedToken && savedUser) { try { const verified = await request<{ user: AuthUser }>(defaultServer, '/auth/verify', savedToken.password); setToken(savedToken.password); setUser(verified.user) } catch { await Promise.all([Keychain.resetGenericPassword({ service: TOKEN_SERVICE }), Keychain.resetGenericPassword({ service: USER_SERVICE })]) } }
    setRestoring(false)
  })() }, [])
  const login = async (email: string, password: string) => {
    const session = await request<{ token: string; user: AuthUser }>(defaultServer, '/auth/login', null, { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), password }) })
    await Promise.all([Keychain.setGenericPassword('token', session.token, { service: TOKEN_SERVICE }), Keychain.setGenericPassword('user', JSON.stringify(session.user), { service: USER_SERVICE })])
    setToken(session.token); setUser(session.user)
  }
  const logout = async () => { await Promise.all([Keychain.resetGenericPassword({ service: TOKEN_SERVICE }), Keychain.resetGenericPassword({ service: USER_SERVICE })]); setToken(null); setUser(null) }
  const value = useMemo(() => ({ user, token, serverUrl: defaultServer, restoring, login, logout }), [user, token, restoring])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value }
