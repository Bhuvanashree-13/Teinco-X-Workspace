import { useEffect, useState } from 'react'
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { normalizeServerUrl } from './api'
import { colors } from './theme'
import { APP_VERSION, isNewerVersion } from './update-version'
const updateServer = normalizeServerUrl('https://teinco-x-workspace-production.up.railway.app')

export type AndroidUpdate = {
  version: string
  versionCode: number
  downloadUrl: string
  required?: boolean
  notes?: string
}

export function AppUpdatePrompt() {
  const [update, setUpdate] = useState<AndroidUpdate | null>(null)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void fetch(`${updateServer}/api/mobile/android/update`, { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then((result: AndroidUpdate | null) => { if (result?.downloadUrl && isNewerVersion(result.version, APP_VERSION)) setUpdate(result) })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])
  if (!update || dismissed) return null
  return <Modal transparent animationType="fade" visible onRequestClose={() => { if (!update.required) setDismissed(true) }}>
    <View style={styles.backdrop}><View style={styles.card}>
      <Text style={styles.eyebrow}>UPDATE AVAILABLE</Text>
      <Text style={styles.title}>Teinco-X {update.version}</Text>
      <Text style={styles.message}>{update.notes || 'A newer version of Teinco-X is ready to install.'}</Text>
      <Pressable accessibilityRole="button" style={styles.primary} onPress={() => void Linking.openURL(update.downloadUrl)}><Text style={styles.primaryText}>Download update</Text></Pressable>
      {!update.required && <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => setDismissed(true)}><Text style={styles.secondaryText}>Later</Text></Pressable>}
      <Text style={styles.caption}>Android will ask you to approve the installation. Install over the current app to keep your data.</Text>
    </View></View>
  </Modal>
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, .55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: 24, backgroundColor: '#fff', padding: 24, gap: 14 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '800' },
  message: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  primary: { minHeight: 50, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondary: { minHeight: 46, borderRadius: 15, backgroundColor: colors.softBlue, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
})
