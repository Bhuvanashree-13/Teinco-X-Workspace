import { useEffect, useRef } from 'react'
import { AccessibilityInfo, ActivityIndicator, Animated, NativeModules, StatusBar, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BrandDisplay } from '../components/BrandDisplay'
import { colors, themedStyles, useMobileTheme } from '../theme'
import { APP_VERSION } from '../update-version'

const SPLASH_BLUE = '#3156B5'
const COIN_GOLD = '#F4C542'

export function SplashScreen() {
  useMobileTheme()
  const reveal = useRef(new Animated.Value(0)).current
  const particles = useRef(Array.from({ length: 11 }, () => new Animated.Value(0))).current
  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!mounted) return
      if (reduced) { reveal.setValue(1); return }
      NativeModules.SplashSound?.play?.()
      Animated.spring(reveal, { toValue: 1, speed: 11, bounciness: 7, useNativeDriver: true }).start()
      particles.forEach((particle, index) => Animated.timing(particle, { toValue: 1, delay: index * 70, duration: 900 + index * 35, useNativeDriver: true }).start())
    }).catch(() => {})
    return () => { mounted = false; reveal.stopAnimation(); particles.forEach(value => value.stopAnimation()) }
  }, [particles, reveal])
  return <SafeAreaView style={styles.page}>
    <StatusBar barStyle="light-content" backgroundColor={SPLASH_BLUE} />
    <View pointerEvents="none" style={styles.particles}>{particles.map((value, index) => {
      const coin = index % 3 === 0
      return <Animated.View key={index} style={[coin ? styles.coin : styles.bubble, { left: `${5 + (index * 19) % 88}%`, backgroundColor: coin ? COIN_GOLD : (index % 2 ? '#9F8CFF' : '#78D7FF'), opacity: value.interpolate({ inputRange: [0, .12, .82, 1], outputRange: [0, .82, .7, 0] }), transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [-70 - index * 12, 650] }) }, { rotate: value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${index % 2 ? 240 : -220}deg`] }) }] }]}>{coin && <Text style={styles.coinText}>₹</Text>}</Animated.View>
    })}</View>
    <Animated.View style={[styles.center, { opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [.78, 1] }) }, { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}><BrandDisplay light /></Animated.View>
    <Animated.View style={[styles.footer, { opacity: reveal }]}>
      <ActivityIndicator color={colors.heroText} accessibilityLabel="Opening workspace" />
      <Text style={styles.caption}>Opening your workspace…</Text>
      <Text style={styles.version}>Version {APP_VERSION}</Text>
    </Animated.View>
  </SafeAreaView>
}

const styles = themedStyles(() => ({
  page: { flex: 1, backgroundColor: SPLASH_BLUE, paddingHorizontal: 24 },
  particles: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  bubble: { position: 'absolute', top: 0, width: 18, height: 18, borderRadius: 9 },
  coin: { position: 'absolute', top: 0, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFE69A' },
  coinText: { color: '#5D4300', fontSize: 15, fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  footer: { alignItems: 'center', gap: 12, paddingBottom: 28 },
  caption: { color: colors.heroMuted, fontSize: 14 },
  version: { color: colors.heroMuted, fontSize: 12, marginTop: 12 },
}))
