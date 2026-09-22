import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Appearance } from 'react-native'

export type MobileTheme = 'light' | 'dark'
import { light, dark } from './palettes'
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
