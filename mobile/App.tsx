import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons, type IoniconsIconName } from '@react-native-vector-icons/ionicons'
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from './src/auth/AuthContext'
import { colors } from './src/theme'
import { LoginScreen } from './src/screens/LoginScreen'
import { HomeScreen } from './src/screens/HomeScreen'
import { ExpensesScreen } from './src/screens/ExpensesScreen'
import { SubscriptionsScreen } from './src/screens/SubscriptionsScreen'
import { AccountScreen } from './src/screens/AccountScreen'

const Tabs = createBottomTabNavigator()
const navigationTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary } }

function AppShell() {
  const { user, restoring } = useAuth()
  if (restoring) return <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary} /></View>
  if (!user) return <LoginScreen />
  return <NavigationContainer theme={navigationTheme}>
    <Tabs.Navigator screenOptions={({ route }) => ({
      headerShadowVisible: false, headerStyle: { backgroundColor: colors.background }, headerTitleStyle: { color: colors.ink, fontWeight: '700' },
      tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { borderTopColor: colors.border, height: 64, paddingTop: 6, paddingBottom: 8 },
      tabBarIcon: ({ color, size }) => {
        const icons: Record<string, IoniconsIconName> = { Home: 'grid-outline', Expenses: 'receipt-outline', Subscriptions: 'repeat-outline', Account: 'person-outline' }
        return <Ionicons name={icons[route.name]} size={size} color={color} />
      },
    })}>
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: user.role === 'admin' ? 'Dashboard' : 'Workspace' }} />
      {user.role === 'admin' && <Tabs.Screen name="Expenses" component={ExpensesScreen} />}
      <Tabs.Screen name="Subscriptions" component={SubscriptionsScreen} />
      <Tabs.Screen name="Account" component={AccountScreen} />
    </Tabs.Navigator>
  </NavigationContainer>
}

export default function App() {
  return <SafeAreaProvider><StatusBar barStyle="dark-content" backgroundColor={colors.background} /><AuthProvider><AppShell /></AuthProvider></SafeAreaProvider>
}
const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } })
