import { useEffect, useState } from 'react'
import { Image, View } from 'react-native'
import { colors } from '../theme'
import { Icon } from './Ui'

export function ProjectLogo({ logoDataUrl, color, size = 48 }: { logoDataUrl?: string | null; color?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [logoDataUrl])
  const radius = Math.round(size * .3)
  const style = { width: size, height: size, borderRadius: radius }
  if (logoDataUrl && !failed) return <View style={[style, { overflow: 'hidden', backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border }]}><Image source={{ uri: logoDataUrl }} resizeMode="contain" accessibilityLabel="Project logo" onError={() => setFailed(true)} style={{ width: '100%', height: '100%' }} /></View>
  return <View style={[style, { alignItems: 'center', justifyContent: 'center', backgroundColor: color ? `${color}20` : colors.softGreen }]}><Icon name="folder-open-outline" color={color || colors.accent} size={Math.round(size * .48)} /></View>
}
