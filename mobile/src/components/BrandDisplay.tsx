import { Image, Text, View } from 'react-native'
import { colors, themedStyles, useMobileTheme } from '../theme'

export const BRAND_BACKGROUND = '#123D3A'

export function BrandDisplay({ light = false }: { light?: boolean }) {
  useMobileTheme()
  return <View style={styles.brand} accessible accessibilityLabel="Teinco-X. Money, people and work.">
    <View style={styles.logo}><Image source={require('../../assets/teinco-logo.png')} resizeMode="contain" style={styles.image} /></View>
    <Text style={[styles.name, light && styles.light]}>Teinco-X</Text>
    <Text style={[styles.tagline, light && styles.lightMuted]}>Money, people and work.</Text>
  </View>
}

const styles = themedStyles(() => ({
  brand: { alignItems: 'center', gap: 16, width: '100%' },
  logo: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18 },
  image: { width: 190, height: 76 },
  name: { color: colors.ink, fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  tagline: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  light: { color: colors.heroText },
  lightMuted: { color: colors.heroMuted },
}))
