import { useEffect, useState } from 'react'
import { Linking, Modal, Platform, Pressable, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { normalizeServerUrl } from './api'
import { colors, themedStyles, useMobileTheme } from './theme'
import { APP_VERSION, isNewerVersion, shouldPromptForUpdate } from './update-version'
const updateServer = normalizeServerUrl('https://teinco-x-workspace-production.up.railway.app')
const PROMPTED_UPDATE_KEY = 'teinco:prompted-android-update'

export type AndroidUpdate = {
  version: string
  versionCode: number
  downloadUrl: string
  required?: boolean
  notes?: string
}

export async function checkForAndroidUpdate(signal?: AbortSignal) {
  const response = await fetch(`${updateServer}/api/mobile/android/update?check=${Date.now()}`, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }, signal })
  if (!response.ok) throw new Error('Could not check for updates.')
  const result = await response.json() as AndroidUpdate
  return result?.downloadUrl && isNewerVersion(result.version, APP_VERSION) ? result : null
}

export async function openAndroidUpdate(downloadUrl: string) {
  const url = new URL(downloadUrl)
  if (url.protocol !== 'https:') throw new Error('The update link is not secure.')
  await Linking.openURL(downloadUrl)
}

export function AppUpdatePrompt() {
  useMobileTheme()
  const [update, setUpdate] = useState<AndroidUpdate | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [opening, setOpening] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    if (Platform.OS !== 'android') return
    const controller = new AbortController()
    void Promise.all([checkForAndroidUpdate(controller.signal), AsyncStorage.getItem(PROMPTED_UPDATE_KEY)]).then(async ([result, promptedVersion]) => {
      if (result && shouldPromptForUpdate(result.version, promptedVersion)) {
        await AsyncStorage.setItem(PROMPTED_UPDATE_KEY, result.version)
        setUpdate(result)
      }
    }).catch(() => undefined)
    return () => controller.abort()
  }, [])
  if (!update || dismissed) return null
  const later = () => { if (!update.required) setDismissed(true) }
  const download = async () => {
    if (opening) return
    setOpening(true); setError('')
    try { await openAndroidUpdate(update.downloadUrl) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open the update download.') }
    finally { setOpening(false) }
  }
  return <Modal transparent animationType="fade" visible onRequestClose={later}>
    <View style={styles.backdrop}><View style={styles.card}>
      <Text style={styles.eyebrow}>UPDATE AVAILABLE</Text>
      <Text style={styles.title}>Teinco-X {update.version}</Text>
      <Text style={styles.message}>{update.notes || 'A newer version of Teinco-X is ready to install.'}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: opening }} disabled={opening} style={[styles.primary, opening && styles.disabled]} onPress={() => void download()}><Text style={styles.primaryText}>{opening ? 'Opening download…' : 'Update now'}</Text></Pressable>
      {!update.required && <Pressable accessibilityRole="button" style={styles.secondary} onPress={later}><Text style={styles.secondaryText}>Later</Text></Pressable>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Text style={styles.caption}>The download opens once in your browser. After it finishes, tap the APK and approve installation. Google Play Protect controls whether a scan is shown.</Text>
    </View></View>
  </Modal>
}

const styles = themedStyles(() => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, .55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 24, gap: 14 },
  eyebrow: { color: colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '700' },
  message: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  primary: { minHeight: 50, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
  secondary: { minHeight: 46, borderRadius: 15, backgroundColor: colors.softBlue, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: .65 }, error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18 },
}))
