import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { ActivityIndicator, StatusBar, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from './src/auth/AuthContext'
import { colors } from './src/theme'
import { LoginScreen } from './src/screens/LoginScreen'
import { AccountScreen } from './src/screens/AccountScreen'
import { HomeScreen, GroupScreen, MoreScreen, ScheduleScreen } from './src/native/HomeScreens'
import { RecordsScreen } from './src/native/RecordsScreen'
import { DetailScreen } from './src/native/DetailScreen'
import { EditScreen } from './src/native/EditScreen'
import { AnalyticsScreen } from './src/native/AnalyticsScreen'
import { AskAIScreen, FlowScreen } from './src/native/IntelligenceScreens'
import { SettingsScreen } from './src/native/SettingsScreen'
import { Icon } from './src/native/Ui'
import { moduleById } from './src/native/domain'
import type { RootStack } from './src/native/navigation'
import { AppUpdatePrompt } from './src/updates'
const Tabs = createBottomTabNavigator()
const Stack = createNativeStackNavigator<RootStack>()
const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.background, primary: colors.primary, card: '#fff', text: colors.ink, border: colors.border } }
function FinanceScreen() { return <GroupScreen group="finance" /> }
function PeopleScreen() { return <GroupScreen group="people" /> }
function MainTabs() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}><Tabs.Navigator screenOptions={({ route }) => ({
    headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { borderTopColor: colors.border, height: 68 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) }, tabBarItemStyle: { paddingVertical: 2 }, tabBarLabelPosition: 'below-icon', tabBarLabelStyle: { fontSize: 11, lineHeight: 16, marginTop: 3, fontWeight: '600', fontFamily: 'sans-serif' }, tabBarIconStyle: { height: 26 },
    tabBarIcon: ({ color, size, focused }) => <Icon color={color} size={24} name={({ Home: focused ? 'home' : 'home-outline', Finance: focused ? 'wallet' : 'wallet-outline', People: focused ? 'people' : 'people-outline', Schedule: focused ? 'calendar' : 'calendar-outline', More: focused ? 'grid' : 'grid-outline' } as Record<string, string>)[route.name]} />,
  })}>
    <Tabs.Screen name="Home" component={HomeScreen} />
    {user?.role === 'admin' && <Tabs.Screen name="Finance" component={FinanceScreen} />}
    <Tabs.Screen name="People" component={PeopleScreen} />
    <Tabs.Screen name="Schedule" component={ScheduleScreen} />
    <Tabs.Screen name="More" component={MoreScreen} />
  </Tabs.Navigator></SafeAreaView>
}
function Shell() {
  const { user, restoring } = useAuth()
  if (restoring) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.accent} size="large" /></View>
  if (!user) return <LoginScreen />
  return <NavigationContainer theme={theme}><Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.primary, headerShadowVisible: false, headerTitleStyle: { fontSize: 17, fontWeight: '700' }, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
    <Stack.Screen name="Records" component={RecordsScreen} options={({ route }) => ({ title: moduleById(route.params.module).title })} />
    <Stack.Screen name="Detail" component={DetailScreen} options={({ route }) => ({ title: moduleById(route.params.module).singular })} />
    <Stack.Screen name="Edit" component={EditScreen} options={({ route }) => ({ title: `${route.params.row ? 'Edit' : 'New'} ${moduleById(route.params.module).singular.toLowerCase()}`, presentation: 'modal' })} />
    <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Analytics' }} />
    <Stack.Screen name="Flow" component={FlowScreen} options={{ title: 'Flow' }} />
    <Stack.Screen name="AskAI" component={AskAIScreen} options={{ title: 'Vyom' }} />
    <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
  </Stack.Navigator></NavigationContainer>
}
export default function App() { return <SafeAreaProvider><StatusBar barStyle="dark-content" backgroundColor={colors.background} /><AuthProvider><Shell /><AppUpdatePrompt /></AuthProvider></SafeAreaProvider> }
