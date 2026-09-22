import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useEffect, useState } from 'react'
import { StatusBar, View } from 'react-native'
import { SplashScreen } from './src/screens/SplashScreen'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from './src/auth/AuthContext'
import { colors, MobileThemeProvider, useMobileTheme } from './src/theme'
import { LoginScreen } from './src/screens/LoginScreen'
import { AccountScreen } from './src/screens/AccountScreen'
import { ScheduleScreen } from './src/native/HomeScreens'
import { HomeScreen, GroupScreen, MoreScreen } from './src/native/WorkspaceScreens'
import { AppUpdatePrompt } from './src/updates'
import { RecordsScreen } from './src/native/RecordsScreen'
import { DetailScreen } from './src/native/DetailScreen'
import { EditScreen } from './src/native/EditScreen'
import { AnalyticsScreen } from './src/native/AnalyticsScreen'
import { AskAIScreen, FlowScreen } from './src/native/IntelligenceScreens'
import { SettingsScreen } from './src/native/SettingsScreen'
import { Icon } from './src/native/Ui'
import { moduleById } from './src/native/domain'
import type { RootStack } from './src/native/navigation'
import { NotificationBanner } from './src/native/NotificationBanner'
const Tabs = createBottomTabNavigator()
const Stack = createNativeStackNavigator<RootStack>()
function FinanceScreen() {
  useMobileTheme()
 return <GroupScreen group="finance" /> }
function PeopleScreen() {
  useMobileTheme()
 return <GroupScreen group="people" /> }
function MainTabs() {
  useMobileTheme()

  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}><Tabs.Navigator screenOptions={({ route }) => ({
    headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 76 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) }, tabBarItemStyle: { paddingVertical: 2 }, tabBarLabelPosition: 'below-icon', tabBarLabelStyle: { fontSize: 12, lineHeight: 17, marginTop: 3, fontWeight: '600',  }, tabBarIconStyle: { height: 34 },
    tabBarIcon: ({ color, size, focused }) => <View style={{ width: 52, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.softBlue : 'transparent' }}><Icon color={color} size={24} name={({ Home: focused ? 'home' : 'home-outline', Finance: focused ? 'wallet' : 'wallet-outline', People: focused ? 'people' : 'people-outline', Vyom: focused ? 'sparkles' : 'sparkles-outline', More: focused ? 'grid' : 'grid-outline' } as Record<string, string>)[route.name]} /></View>,
  })}>
    <Tabs.Screen name="Home" component={HomeScreen} />
    {user?.role === 'admin' && <Tabs.Screen name="Finance" component={FinanceScreen} />}
    <Tabs.Screen name="People" component={PeopleScreen} options={{ title: 'Workspace' }} />
    {user?.role === 'admin' && <Tabs.Screen name="Vyom" component={AskAIScreen} />}
    <Tabs.Screen name="More" component={MoreScreen} />
  </Tabs.Navigator>{user?.role === 'admin' && <NotificationBanner />}</SafeAreaView>
}
function Shell() {
  const [introComplete, setIntroComplete] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setIntroComplete(true), 1800)
    return () => clearTimeout(timer)
  }, [])
  const { user, restoring } = useAuth()
  const { theme: themeMode } = useMobileTheme()
  const theme = { ...DefaultTheme, dark: themeMode === 'dark', colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary, card: colors.surface, text: colors.ink, border: colors.border, notification: colors.violet } }
  if (restoring || !introComplete) return <SplashScreen />
  if (!user) return <LoginScreen />
  return <NavigationContainer theme={theme}><Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.primary, headerShadowVisible: false, headerTitleStyle: { color: colors.ink, fontSize: 17, fontWeight: '700' }, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
    <Stack.Screen name="Records" component={RecordsScreen} options={({ route }) => ({ title: moduleById(route.params.module).title })} />
    <Stack.Screen name="Detail" component={DetailScreen} options={({ route }) => ({ title: moduleById(route.params.module).singular })} />
    <Stack.Screen name="Edit" component={EditScreen} options={({ route }) => ({ title: `${route.params.row ? 'Edit' : 'New'} ${moduleById(route.params.module).singular.toLowerCase()}`, presentation: 'modal' })} />
    <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Analytics' }} />
    <Stack.Screen name="Flow" component={FlowScreen} options={{ title: 'Flow' }} />
    <Stack.Screen name="AskAI" component={AskAIScreen} options={{ title: 'Vyom' }} />
    <Stack.Screen name="Schedule" component={ScheduleScreen} options={{ title: 'Schedule' }} />
    <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
  </Stack.Navigator></NavigationContainer>
}
export default function App() {
 return <MobileThemeProvider><SafeAreaProvider><ThemedStatusBar/><AuthProvider><Shell /><AppUpdatePrompt /></AuthProvider></SafeAreaProvider></MobileThemeProvider> }
function ThemedStatusBar() { const { theme } = useMobileTheme(); return <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.statusBar} /> }
