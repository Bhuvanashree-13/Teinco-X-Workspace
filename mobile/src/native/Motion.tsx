import { ReactNode, useEffect, useRef } from 'react'
import { AccessibilityInfo, Animated, Pressable, StyleProp, ViewStyle } from 'react-native'

export function Reveal({ children, delay = 0, distance = 16, style }: { children: ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle> }) {
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!mounted) return
      if (reduced) return progress.setValue(1)
      Animated.spring(progress, { toValue: 1, delay, speed: 15, bounciness: 3, useNativeDriver: true }).start()
    }).catch(() => progress.setValue(1))
    return () => { mounted = false; progress.stopAnimation() }
  }, [delay, progress])
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>{children}</Animated.View>
}

export function MotionPressable({ children, onPress, style, accessibilityLabel }: { children: ReactNode; onPress: () => void; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const scale = useRef(new Animated.Value(1)).current
  const animate = (toValue: number) => Animated.spring(scale, { toValue, speed: 30, bounciness: 2, useNativeDriver: true }).start()
  return <Animated.View style={{ transform: [{ scale }] }}><Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} onPressIn={() => animate(.97)} onPressOut={() => animate(1)} style={style}>{children}</Pressable></Animated.View>
}
