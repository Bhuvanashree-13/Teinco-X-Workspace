import { useRef, useState } from 'react'
import { GoogleSigninButton } from '@react-native-google-signin/google-signin'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, ScrollView, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthContext'
import { colors } from '../theme'
export function LoginScreen() {
  const { login, loginGoogle } = useAuth(); const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = useRef(false)
  const submit = async () => { if (pending.current) return; if (!email.trim() || !password) { setError('Enter your email and password.'); return } pending.current = true; setBusy(true); setError(''); try { await login(email, password) } catch (err) { setError(err instanceof Error ? err.message : 'Sign in failed') } finally { pending.current = false; setBusy(false) } }
  const googleSubmit = async () => { if (pending.current) return; pending.current = true; setBusy(true); setError(''); try { await loginGoogle() } catch (err) { setError(err instanceof Error ? err.message : 'Google sign-in failed') } finally { pending.current = false; setBusy(false) } }
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.wrap, { flexGrow: 1, flex: undefined }]}>
    <View style={styles.brand}><Image source={require('../../assets/teinco-logo.png')} accessibilityLabel="Teinco-X logo" resizeMode="contain" style={{ width: 154, height: 62, marginBottom: 18 }} /><Text style={styles.name}>Teinco-X</Text><Text style={styles.tagline}>Money, people and work. All in your pocket.</Text></View>
    <View style={styles.form}>
      <GoogleSigninButton style={{ width: '100%', height: 52 }} size={GoogleSigninButton.Size.Wide} color={GoogleSigninButton.Color.Light} onPress={googleSubmit} disabled={busy} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 }}><View style={styles.divider} /><Text style={{ color: colors.muted, fontSize: 12 }}>or use work email</Text><View style={styles.divider} /></View>
      <Text style={styles.label}>Work email</Text><TextInput editable={!busy} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="username" placeholder="you@company.com" style={styles.input} />
      <Text style={styles.label}>Password</Text><TextInput editable={!busy} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" placeholder="Enter your password" style={styles.input} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in securely</Text>}</Pressable>
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>
}
const styles = StyleSheet.create({ divider: { flex: 1, height: 1, backgroundColor: colors.border }, safe: { flex: 1, backgroundColor: colors.background }, wrap: { flex: 1, justifyContent: 'center', padding: 24 }, brand: { marginBottom: 32 }, mark: { width: 52, height: 52, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, markText: { color: '#fff', fontWeight: '900', fontSize: 18 }, name: { fontSize: 30, fontWeight: '800', color: colors.ink }, tagline: { color: colors.muted, marginTop: 8, fontSize: 15 }, form: { backgroundColor: colors.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.border }, label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 10 }, input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 15, color: colors.ink }, error: { color: colors.danger, marginTop: 14 }, button: { height: 52, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 20 }, pressed: { opacity: .75 }, buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 } })
