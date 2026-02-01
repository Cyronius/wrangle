import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import * as monaco from 'monaco-editor'
import { RootState } from '../store/store'
import { builtInThemeNames, builtInThemes } from '../styles/themes'
import { registerCustomMonacoTheme, getMonacoThemeName } from '../utils/monaco-theme-generator'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const currentTheme = useSelector((state: RootState) => state.settings.theme.current)
  const customThemes = useSelector((state: RootState) => state.settings.theme.customThemes)
  const monacoThemesRegistered = useRef(false)

  // Register all built-in themes with Monaco on mount
  useEffect(() => {
    if (monacoThemesRegistered.current) return
    monacoThemesRegistered.current = true
    for (const [name, css] of Object.entries(builtInThemes)) {
      if (name !== 'Lightish' && name !== 'Dark') {
        registerCustomMonacoTheme(name, css)
      }
    }
  }, [])

  useEffect(() => {
    if (builtInThemeNames.has(currentTheme)) {
      // Built-in theme: set attribute and remove any custom style
      document.documentElement.setAttribute('data-theme', currentTheme)
      const existingStyle = document.getElementById('custom-theme-active')
      if (existingStyle) {
        existingStyle.remove()
      }
    } else if (customThemes[currentTheme]) {
      // Custom theme: only switch data-theme after confirming CSS is available
      document.documentElement.setAttribute('data-theme', currentTheme)
      const existingStyle = document.getElementById('custom-theme-active')
      if (existingStyle) {
        existingStyle.textContent = customThemes[currentTheme]
      } else {
        const style = document.createElement('style')
        style.id = 'custom-theme-active'
        style.textContent = customThemes[currentTheme]
        document.head.appendChild(style)
      }
    }

    // Apply Monaco theme immediately so all editor instances update
    const monacoThemeName = getMonacoThemeName(currentTheme)
    try {
      monaco.editor.setTheme(monacoThemeName)
    } catch {
      // Monaco may not be fully initialized yet on first render
    }
  }, [currentTheme, customThemes])

  return <>{children}</>
}
