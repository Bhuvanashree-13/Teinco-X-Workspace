import { useEffect, useState } from 'react'
import { Alert, Linking, Modal, Platform, Pressable, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Clipboard from '@react-native-clipboard/clipboard'
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
  console.log('Checking for updates from:', `${updateServer}/api/mobile/android/update`)
  const response = await fetch(`${updateServer}/api/mobile/android/update?check=${Date.now()}`, { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }, signal })
  if (!response.ok) {
    console.error('Update check failed with status:', response.status)
    throw new Error('Could not check for updates.')
  }
  const result = await response.json() as AndroidUpdate
  console.log('Update check response:', result)
  return result?.downloadUrl && isNewerVersion(result.version, APP_VERSION) ? result : null
}

export async function openAndroidUpdate(downloadUrl: string) {
  const url = new URL(downloadUrl)
  if (url.protocol !== 'https:') throw new Error('The update link is not secure.')
  
  // Try multiple methods to open the download
  try {
    // Method 1: Direct URL open
    await Linking.openURL(downloadUrl)
  } catch (error) {
    console.error('Linking.openURL failed:', error)
    // Method 2: Try with explicit intent
    try {
      await Linking.openURL(`intent://${url.host}${url.pathname}#Intent;scheme=https;package=com.android.chrome;end`)
    } catch (intentError) {
      console.error('Intent method failed:', intentError)
      throw new Error('Could not open download. Please try opening the link manually.')
    }
  }
}

export function AppUpdatePrompt() {
  useMobileTheme()
  const [update, setUpdate] = useState<AndroidUpdate | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [opening, setOpening] = useState(false), [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [forceShow, setForceShow] = useState(false)
  
  useEffect(() => {
    if (Platform.OS !== 'android') return
    
    const controller = new AbortController()
    setChecking(true)
    
    void Promise.all([checkForAndroidUpdate(controller.signal), AsyncStorage.getItem(PROMPTED_UPDATE_KEY)]).then(async ([result, promptedVersion]) => {
      setChecking(false)
      console.log('Update check result:', result, 'Prompted version:', promptedVersion, 'Current version:', APP_VERSION)
      
      if (result && shouldPromptForUpdate(result.version, promptedVersion)) {
        await AsyncStorage.setItem(PROMPTED_UPDATE_KEY, result.version)
        setUpdate(result)
      } else if (result) {
        console.log('Update available but already prompted for version:', result.version)
      } else {
        console.log('No update available - server version matches or is older than app version')
      }
    }).catch((err) => {
      setChecking(false)
      console.error('Update check failed:', err)
    })
    
    return () => controller.abort()
  }, [])
  
  // For testing: force show the update prompt
  const showTestPrompt = () => {
    setUpdate({
      version: '2.1.21',
      versionCode: 55,
      downloadUrl: 'https://github.com/Bhuvanashree-13/Teinco-X-Workspace/releases/download/v2.1.21/Teinco-X-2.1.21.apk',
      required: false,
      notes: 'Test update prompt - This is a test to verify the update mechanism works properly.'
    })
  }
  
  // Debug: clear the prompted version to re-prompt
  const clearPromptedVersion = async () => {
    await AsyncStorage.removeItem(PROMPTED_UPDATE_KEY)
    console.log('Cleared prompted version - will check for updates again')
    setDismissed(false)
    setUpdate(null)
    setForceShow(true)
    // Re-trigger the update check
    setTimeout(() => {
      const controller = new AbortController()
      setChecking(true)
      void Promise.all([checkForAndroidUpdate(controller.signal), AsyncStorage.getItem(PROMPTED_UPDATE_KEY)]).then(async ([result, promptedVersion]) => {
        setChecking(false)
        console.log('Re-check result:', result, 'Prompted version:', promptedVersion)
        if (result && shouldPromptForUpdate(result.version, promptedVersion)) {
          await AsyncStorage.setItem(PROMPTED_UPDATE_KEY, result.version)
          setUpdate(result)
        }
        setForceShow(false)
      }).catch((err) => {
        setChecking(false)
        console.error('Re-check failed:', err)
        setForceShow(false)
      })
    }, 500)
  }
  
  // Add a debug button in development mode
  if (__DEV__) {
    return (
      <>
        {(update || dismissed) || <View style={{ position: 'absolute', top: 50, right: 10, zIndex: 9999 }}>
          <Pressable onPress={showTestPrompt} style={{ backgroundColor: 'rgba(255,0,0,0.7)', padding: 8, borderRadius: 8 }}>
            <Text style={{ color: 'white', fontSize: 10 }}>Test Update</Text>
          </Pressable>
          <Pressable onPress={clearPromptedVersion} style={{ backgroundColor: 'rgba(0,0,255,0.7)', padding: 8, borderRadius: 8, marginLeft: 8 }}>
            <Text style={{ color: 'white', fontSize: 10 }}>Clear & Recheck</Text>
          </Pressable>
        </View>}
        {update && !dismissed && <Modal transparent animationType="fade" visible onRequestClose={later}>
          <View style={styles.backdrop}><View style={styles.card}>
            <Text style={styles.eyebrow}>UPDATE AVAILABLE</Text>
            <Text style={styles.title}>Teinco-X {update.version}</Text>
            <Text style={styles.message}>{update.notes || 'A newer version of Teinco-X is ready to install.'}</Text>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: opening }} disabled={opening} style={[styles.primary, opening && styles.disabled]} onPress={() => void download()}><Text style={styles.primaryText}>{opening ? 'Opening download…' : 'Update now'}</Text></Pressable>
            {!update.required && <Pressable accessibilityRole="button" style={styles.secondary} onPress={later}><Text style={styles.secondaryText}>Later</Text></Pressable>}
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <Text style={styles.caption}>Download size: ~67 MB. Opens in browser. Tap the downloaded APK to install. If blocked, enable "Install unknown apps" in Settings. Google Play Protect may warn - proceed if you trust this source.</Text>
            <Pressable accessibilityRole="button" style={styles.linkButton} onPress={async () => {
              try {
                await Clipboard.setString(update.downloadUrl)
                Alert.alert('Link copied', 'Download link copied to clipboard. You can paste it in your browser.')
              } catch {
                setError('Could not copy link')
              }
            }}>
              <Text style={styles.linkText}>Copy download link</Text>
            </Pressable>
          </View></View>
        </Modal>}
      </>
    )
  }
  
  if (!update || dismissed) return null
  
  const later = () => { if (!update.required) setDismissed(true) }
  
  const download = async () => {
    if (opening) return
    setOpening(true); setError('')
    try { 
      await openAndroidUpdate(update.downloadUrl)
      // Add additional help text after opening
      setTimeout(() => {
        setError('If the download doesn\'t start, check your Downloads folder or try the link manually.')
      }, 2000)
    }
    catch (reason) { 
      setError(reason instanceof Error ? reason.message : 'Could not open the update download. Please check your internet connection and try again.') 
    }
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
      <Text style={styles.caption}>Download size: ~67 MB. Opens in browser. Tap the downloaded APK to install. If blocked, enable "Install unknown apps" in Settings. Google Play Protect may warn - proceed if you trust this source.</Text>
      <Pressable accessibilityRole="button" style={styles.linkButton} onPress={async () => {
        try {
          await Clipboard.setString(update.downloadUrl)
          Alert.alert('Link copied', 'Download link copied to clipboard. You can paste it in your browser.')
        } catch {
          setError('Could not copy link')
        }
      }}>
        <Text style={styles.linkText}>Copy download link</Text>
      </Pressable>
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
  linkButton: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: colors.accent, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
}))
