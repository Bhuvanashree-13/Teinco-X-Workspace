import { useCallback, useEffect, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'teinco-x-theme'

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    readPreference() === 'system' ? systemTheme() : (readPreference() as ResolvedTheme)
  )

  useEffect(() => {
    const resolved = preference === 'system' ? systemTheme() : preference
    setResolvedTheme(resolved)
    applyTheme(resolved)
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  }, [preference])

  useEffect(() => {
    if (preference !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next = media.matches ? 'dark' : 'light'
      setResolvedTheme(next)
      applyTheme(next)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  const setTheme = useCallback((next: ThemePreference) => setPreference(next), [])
  const toggle = useCallback(() => {
    setPreference(current => (current === 'system' ? (systemTheme() === 'dark' ? 'light' : 'dark') : current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { preference, resolvedTheme, setTheme, toggle }
}