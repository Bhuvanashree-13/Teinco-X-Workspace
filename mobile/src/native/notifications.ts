import { NativeModules, PermissionsAndroid, Platform } from 'react-native'

type NativeNotifications = { show: (id: string, title: string, message: string) => void }
const nativeNotifications = NativeModules.TeincoNotifications as NativeNotifications | undefined

export async function requestNotificationPermission() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true
  const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, {
    title: 'Enable notifications',
    message: 'Teinco-X uses notifications for new attendance and workspace updates.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  })
  return status === PermissionsAndroid.RESULTS.GRANTED
}

export function showPhoneNotification(id: string, title: string, message: string) {
  if (Platform.OS === 'android') nativeNotifications?.show(id, title, message)
}
