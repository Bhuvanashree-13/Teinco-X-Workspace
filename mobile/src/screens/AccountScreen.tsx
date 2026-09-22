import { Alert, ScrollView, Text, View } from 'react-native'
import { useAuth } from '../auth/AuthContext'
import { colors, useMobileTheme } from '../theme'
import { APP_VERSION } from '../update-version'
import { Button, Icon, Panel, RowValue, s } from '../native/Ui'
export function AccountScreen() {
  useMobileTheme()
  const { user, logout } = useAuth()
  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.softGreen, alignItems: 'center', justifyContent: 'center' }}><Icon name="person-outline" size={34} /></View>
      <Text style={[s.title, { textAlign: 'center' }]}>{user?.name || 'Your account'}</Text><Text style={s.caption}>{user?.email}</Text>
    </View>
    <Panel><RowValue label="Workspace" value="Teinco-X" /><RowValue label="Access" value={user?.role === 'admin' ? 'Administrator' : 'Employee'} /><RowValue label="App version" value={APP_VERSION} /></Panel>
    <Panel><Text style={s.sectionTitle}>Your work, connected.</Text><Text style={s.caption}>Your changes sync with your company workspace. Sign in with your work account to pick up where you left off.</Text></Panel>
    <Button danger label="Sign out" icon="log-out-outline" onPress={() => Alert.alert('Sign out?', 'You can sign back in with your work account.', [{ text: 'Stay signed in', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => void logout() }])} />
  </ScrollView>
}