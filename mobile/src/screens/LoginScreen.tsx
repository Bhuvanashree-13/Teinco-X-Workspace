import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../auth/AuthContext'
import { colors } from '../theme'
export function LoginScreen() {
  const { login } = useAuth(); const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const submit = async () => { if (!email.trim() || !password) { setError('Enter your email and password.'); return } setBusy(true); setError(''); try { await login(email, password) } catch (err) { setError(err instanceof Error ? err.message : 'Sign in failed') } finally { setBusy(false) } }
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
    <View style={styles.brand}><View style={styles.mark}><Text style={styles.markText}>TX</Text></View><Text style={styles.name}>Teinco-X Finance</Text><Text style={styles.tagline}>Your workspace finances, wherever work happens.</Text></View>
    <View style={styles.form}>
      <Text style={styles.label}>Work email</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="username" placeholder="you@company.com" style={styles.input} />
      <Text style={styles.label}>Password</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry textContentType="password" placeholder="Enter your password" style={styles.input} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in securely</Text>}</Pressable>
    </View>
  </KeyboardAvoidingView></SafeAreaView>
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, wrap: { flex: 1, justifyContent: 'center', padding: 24 }, brand: { marginBottom: 32 }, mark: { width: 52, height: 52, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, markText: { color: '#fff', fontWeight: '900', fontSize: 18 }, name: { fontSize: 30, fontWeight: '800', color: colors.ink }, tagline: { color: colors.muted, marginTop: 8, fontSize: 15 }, form: { backgroundColor: colors.surface, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.border }, label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 10 }, input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 15, color: colors.ink }, error: { color: colors.danger, marginTop: 14 }, button: { height: 52, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 20 }, pressed: { opacity: .75 }, buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 } })
