import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import * as Keychain from 'react-native-keychain'
import { Alert, NativeModules, Platform } from 'react-native'
import { AuthUser, normalizeServerUrl, request } from '../api'
import { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin'
const TOKEN_KEY = 'teinco.mobile.token', USER_KEY = 'teinco.mobile.user'
const TOKEN_SERVICE = TOKEN_KEY, USER_SERVICE = USER_KEY
const defaultServer = normalizeServerUrl('https://teinco-x-workspace-production.up.railway.app')
async function clearWebSession() {
  if (Platform.OS === 'android') await NativeModules.WorkspaceStorage.clear()
}
type AuthValue = { user: AuthUser | null; token: string | null; serverUrl: string; restoring: boolean; login: (email: string, password: string) => Promise<void>; loginGoogle: () => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthValue | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null), [token, setToken] = useState<string | null>(null), [restoring, setRestoring] = useState(true)
  useEffect(() => { void (async () => {
    try {
      await clearWebSession()
      const [savedToken, savedUser] = await Promise.all([Keychain.getGenericPassword({ service: TOKEN_SERVICE }), Keychain.getGenericPassword({ service: USER_SERVICE })])
      if (savedToken && savedUser) {
        try {
          const verified = await request<{ user: AuthUser }>(defaultServer, '/auth/verify', savedToken.password)
          setToken(savedToken.password); setUser(verified.user)
        } catch {
          await Promise.all([Keychain.resetGenericPassword({ service: TOKEN_SERVICE }), Keychain.resetGenericPassword({ service: USER_SERVICE })])
        }
      }
    } catch { setToken(null); setUser(null) }
    finally { setRestoring(false) }
  })() }, [])
  const saveSession = async (session: { token: string; user: AuthUser }) => {
    await clearWebSession()
    await Promise.all([Keychain.setGenericPassword('token', session.token, { service: TOKEN_SERVICE }), Keychain.setGenericPassword('user', JSON.stringify(session.user), { service: USER_SERVICE })])
    setToken(session.token); setUser(session.user)
  }
  const login = async (email: string, password: string) => {
    await saveSession(await request(defaultServer, '/auth/login', null, { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), password }) }))
  }
  const loginGoogle = async () => {
    let config: { enabled: boolean; clientId?: string }
    try { config = await request(defaultServer, '/auth/google/native/config') }
    catch { throw new Error('Google sign-in for Android is awaiting workspace setup. Please use email and password for now.') }
    if (!config.enabled || !config.clientId) throw new Error('Google sign-in for Android is awaiting workspace setup. Please use email and password for now.')
    GoogleSignin.configure({ webClientId: config.clientId })
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      const result = await GoogleSignin.signIn()
      if (!isSuccessResponse(result)) return
      if (!result.data.idToken) throw new Error('Google did not return a sign-in credential. Please try again.')
      await saveSession(await request(defaultServer, '/auth/google/native', null, { method: 'POST', body: JSON.stringify({ credential: result.data.idToken }) }))
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return
      if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Update Google Play services on your phone and try again.')
      throw error
    } finally { await GoogleSignin.signOut().catch(() => undefined) }
  }
  const logout = async () => {
    try {
      await Promise.all([clearWebSession(), Keychain.resetGenericPassword({ service: TOKEN_SERVICE }), Keychain.resetGenericPassword({ service: USER_SERVICE })])
    } catch { Alert.alert('Session cleanup failed', 'Close and reopen the app before signing in again.') }
    finally { setToken(null); setUser(null) }
  }
  const value = useMemo(() => ({ user, token, serverUrl: defaultServer, restoring, login, loginGoogle, logout }), [user, token, restoring])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value }
