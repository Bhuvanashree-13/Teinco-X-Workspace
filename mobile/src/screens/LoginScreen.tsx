import { useRef, useState } from 'react'
import { BrandDisplay } from '../components/BrandDisplay'
import { GoogleSigninButton } from '@react-native-google-signin/google-signin'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthContext'
import { colors as signin, themedStyles, useMobileTheme } from '../theme'
export function LoginScreen() {
  const { theme } = useMobileTheme()
  const { login, loginGoogle } = useAuth(); const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = useRef(false)
  const submit = async () => { if (pending.current) return; if (!email.trim() || !password) { setError('Enter your email and password.'); return } pending.current = true; setBusy(true); setError(''); try { await login(email, password) } catch (err) { setError(err instanceof Error ? err.message : 'Sign in failed') } finally { pending.current = false; setBusy(false) } }
  const googleSubmit = async () => { if (pending.current) return; pending.current = true; setBusy(true); setError(''); try { await loginGoogle() } catch (err) { setError(err instanceof Error ? err.message : 'Google sign-in failed') } finally { pending.current = false; setBusy(false) } }
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.wrap, { flexGrow: 1, flex: undefined }]}>
    <View style={styles.brand}><BrandDisplay /></View>
    <View style={styles.form}>
      <GoogleSigninButton style={{ width: '100%', height: 52 }} size={GoogleSigninButton.Size.Wide} color={theme === 'dark' ? GoogleSigninButton.Color.Dark : GoogleSigninButton.Color.Light} onPress={googleSubmit} disabled={busy} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 }}><View style={styles.divider} /><Text style={{ color: signin.muted, fontSize: 12 }}>or use work email</Text><View style={styles.divider} /></View>
      <Text style={styles.label}>Work email</Text><TextInput selectionColor={signin.primary} editable={!busy} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="username" placeholder="you@company.com" placeholderTextColor={signin.subtle} style={styles.input} />
      <Text style={styles.label}>Password</Text><TextInput selectionColor={signin.primary} editable={!busy} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" placeholder="Enter your password" placeholderTextColor={signin.subtle} style={styles.input} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}>{busy ? <ActivityIndicator color={signin.onPrimary} /> : <Text style={styles.buttonText}>Sign in securely</Text>}</Pressable>
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>
}
const styles = themedStyles(() => ({ divider: { flex: 1, height: 1, backgroundColor: signin.border }, safe: { flex: 1, backgroundColor: signin.background }, wrap: { flex: 1, justifyContent: 'center', padding: 24 }, brand: { marginBottom: 32 }, name: { fontSize: 30, fontWeight: '700', color: signin.ink }, tagline: { color: signin.muted, marginTop: 8, fontSize: 15 }, form: { backgroundColor: signin.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: signin.border }, label: { color: signin.ink, fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 10 }, input: { borderWidth: 1, borderColor: signin.border, backgroundColor: signin.surfaceRaised, borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 15, color: signin.ink }, error: { color: signin.danger, marginTop: 14 }, button: { height: 52, borderRadius: 12, backgroundColor: signin.primary, alignItems: 'center', justifyContent: 'center', marginTop: 20 }, pressed: { opacity: .75 }, buttonText: { color: signin.onPrimary, fontWeight: '700', fontSize: 15 } }))
