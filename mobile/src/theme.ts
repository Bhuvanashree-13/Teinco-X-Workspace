import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Appearance } from 'react-native'

export type MobileTheme = 'light' | 'dark'
const light = { primary: '#315CF3', accent: '#4770FF', violet: '#7648DD', cyan: '#087F8C', ink: '#101828', muted: '#667085', subtle: '#667085', background: '#F3F6FF', surface: '#FFFFFF', surfaceRaised: '#FFFFFF', border: '#DCE4FA', success: '#12805A', danger: '#C73548', softBlue: '#EEF2FF', softGreen: '#EAFBF3', softAmber: '#FFF2DF', softDanger: '#FEF2F2', amber: '#95600F', statusBar: '#F3F6FF', onPrimary: '#FFFFFF', onDanger: '#FFFFFF', hero: '#315CF3', heroText: '#FFFFFF', heroMuted: '#E4EAFF', shadow: '#315CF3' }
const dark: typeof light = { primary: '#B4A5FF', accent: '#B4A5FF', violet: '#C4ACFF', cyan: '#75D5DE', ink: '#F1EFFA', muted: '#BDB8D4', subtle: '#A49DBE', background: '#191540', surface: '#211D43', surfaceRaised: '#2A254F', border: '#3C355F', success: '#79D6B0', danger: '#FF9AAA', softBlue: '#302851', softGreen: '#203D3D', softAmber: '#403326', softDanger: '#42283F', amber: '#EDC17F', statusBar: '#191540', onPrimary: '#211A40', onDanger: '#351521', hero: '#32285B', heroText: '#F4F0FF', heroMuted: '#D1C7EA', shadow: '#090715' }
export type MobileColors = typeof light
export const colors: MobileColors = { ...light }
export function themedStyles(factory: () => Record<string, any>): any { return new Proxy({}, { get: (_target, property) => factory()[property as string] }) }
const ThemeContext = createContext({ theme: 'light' as MobileTheme, toggle: () => {}, setTheme: (_theme: MobileTheme) => {} })
const STORAGE_KEY = 'teinco-x-mobile-theme'
export function MobileThemeProvider({ children }: { children: ReactNode }) {
  const system = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  const [theme, updateTheme] = useState<MobileTheme>(system)
  const [ready, setReady] = useState(false)
  const selected = useRef(false)
  Object.assign(colors, theme === 'dark' ? dark : light)
  useEffect(() => {
    let active = true
    void AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (active && !selected.current && (saved === 'light' || saved === 'dark')) updateTheme(saved)
    }).catch(() => {}).finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [])
  useEffect(() => { if (ready) Appearance.setColorScheme(theme) }, [theme, ready])
  const setTheme = (next: MobileTheme) => { selected.current = true; updateTheme(next); void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {}) }
  const value = useMemo(() => ({ theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }), [theme])
  return createElement(ThemeContext.Provider, { value }, ready ? children : null)
}
export const useMobileTheme = () => useContext(ThemeContext)
export const currency = (value: number, code = 'INR') => {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(value) || 0) }
  catch { return `${code} ${(Number(value) || 0).toFixed(2)}` }
}
export const shortDate = (value?: string | null) => value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Not scheduled'
