import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Appearance } from 'react-native'

export type MobileTheme = 'light' | 'dark'
const light = { primary: '#315CF3', accent: '#4770FF', violet: '#7648DD', cyan: '#1ABFD0', ink: '#101828', muted: '#667085', subtle: '#98A2B3', background: '#F3F6FF', surface: '#FFFFFF', surfaceRaised: '#FFFFFF', border: '#DCE4FA', success: '#12A06A', danger: '#D64555', softBlue: '#EEF2FF', softGreen: '#EAFBF3', amber: '#B26A11', statusBar: '#F3F6FF' }
const dark = { primary: '#6E8BFF', accent: '#55A7FF', violet: '#A98BFF', cyan: '#55E1DC', ink: '#F7F9FF', muted: '#AEBDDD', subtle: '#7F91B6', background: '#071127', surface: '#111D3B', surfaceRaised: '#162447', border: '#2B3D67', success: '#52D6A1', danger: '#FF7B8A', softBlue: '#172A55', softGreen: '#123B35', amber: '#F6B95E', statusBar: '#071127' }
export type MobileColors = typeof light
export const colors: MobileColors = { ...light }
export function themedStyles(factory: () => Record<string, any>): any { return new Proxy({}, { get: (_target, property) => factory()[property as string] }) }
const ThemeContext = createContext({ theme: 'light' as MobileTheme, toggle: () => {}, setTheme: (_theme: MobileTheme) => {} })
const STORAGE_KEY = 'teinco-x-mobile-theme'
export function MobileThemeProvider({ children }: { children: ReactNode }) {
  const system = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  const [theme, updateTheme] = useState<MobileTheme>(system)
  Object.assign(colors, theme === 'dark' ? dark : light)
  useEffect(() => { void AsyncStorage.getItem(STORAGE_KEY).then(saved => { if (saved === 'light' || saved === 'dark') updateTheme(saved) }) }, [])
  const setTheme = (next: MobileTheme) => { Object.assign(colors, next === 'dark' ? dark : light); updateTheme(next); void AsyncStorage.setItem(STORAGE_KEY, next) }
  const value = useMemo(() => ({ theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }), [theme])
  return createElement(ThemeContext.Provider, { value }, children)
}
export const useMobileTheme = () => useContext(ThemeContext)
export const currency = (value: number, code = 'INR') => {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(value) || 0) }
  catch { return `${code} ${(Number(value) || 0).toFixed(2)}` }
}
export const shortDate = (value?: string | null) => value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Not scheduled'
