import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../auth/AuthContext'
import { useRemote } from '../hooks/useRemote'
import { colors, themedStyles } from '../theme'
import type { Row } from './domain'
import type { RootStack } from './navigation'
import { Icon } from './Ui'
import { requestNotificationPermission, showPhoneNotification } from './notifications'

const SEEN_KEY = 'teinco:last-floating-notification'

export function NotificationBanner() {
  const { user } = useAuth(), admin = user?.role === 'admin'
  const remote = useRemote<Row[]>(admin ? '/employees/notifications' : null)
  const navigation = useNavigation<NativeStackNavigationProp<RootStack>>()
  const [ready, setReady] = useState(false), [seen, setSeen] = useState<string | null>(null), [visible, setVisible] = useState<Row | null>(null)
  const translateY = useRef(new Animated.Value(-130)).current
  useEffect(() => { void AsyncStorage.getItem(SEEN_KEY).then(value => { setSeen(value); setReady(true) }).catch(() => setReady(true)) }, [])
  useEffect(() => { if (admin) void requestNotificationPermission() }, [admin])
  useEffect(() => { if (!admin) return; const timer = setInterval(() => void remote.refresh(), 15000); return () => clearInterval(timer) }, [admin, remote.refresh])
  useEffect(() => {
    if (!ready || visible || !remote.data) return
    const item = remote.data.find(row => ['attendance_checked_in', 'attendance_checked_out'].includes(row.type))
    if (!item || String(item.id) === seen) return
    setVisible(item); setSeen(String(item.id)); void AsyncStorage.setItem(SEEN_KEY, String(item.id)); showPhoneNotification(String(item.id), String(item.title), String(item.message))
    Animated.spring(translateY, { toValue: 0, speed: 18, bounciness: 4, useNativeDriver: true }).start()
    const timer = setTimeout(() => Animated.timing(translateY, { toValue: -130, duration: 240, useNativeDriver: true }).start(() => setVisible(null)), 7000)
    return () => clearTimeout(timer)
  }, [ready, remote.data, seen, translateY, visible])
  if (!visible) return null
  return <Animated.View style={[styles.banner, { transform: [{ translateY }] }]}><Pressable accessibilityRole="button" accessibilityLabel={`${visible.title}. ${visible.message}`} onPress={() => { setVisible(null); navigation.navigate('Records', { module: 'notifications' }) }} style={styles.content}><View style={styles.icon}><Icon name="notifications" color={colors.onPrimary} size={21} /></View><View style={{ flex: 1 }}><Text style={styles.title}>{visible.title}</Text><Text style={styles.message}>{visible.message}</Text></View><Icon name="chevron-forward" color={colors.onPrimary} size={17} /></Pressable></Animated.View>
}

const styles = themedStyles(() => ({
  banner: { position: 'absolute', zIndex: 100, elevation: 12, top: 8, left: 14, right: 14, borderRadius: 20, backgroundColor: colors.primary, shadowColor: colors.shadow, shadowOpacity: .28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  content: { minHeight: 76, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 15, backgroundColor: 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.onPrimary, fontSize: 15, fontWeight: '800' }, message: { color: colors.onPrimary, fontSize: 12, lineHeight: 18, marginTop: 3 },
}))
