import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store/store'
import '../styles/themes/dark.css'
import '../styles/themes/light.css'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const currentTheme = useSelector((state: RootState) => state.settings.theme.current)
  const customThemes = useSelector((state: RootState) => state.settings.theme.customThemes)

  useEffect(() => {
    // Apply theme to root element
    document.documentElement.setAttribute('data-theme', currentTheme)

    // If it's a custom theme, inject its CSS
    if (currentTheme !== 'light' && currentTheme !== 'dark' && customThemes[currentTheme]) {
      const existingStyle = document.getElementById('custom-theme-active')
      if (existingStyle) {
        existingStyle.textContent = customThemes[currentTheme]
      } else {
        const style = document.createElement('style')
        style.id = 'custom-theme-active'
        style.textContent = customThemes[currentTheme]
        document.head.appendChild(style)
      }
    } else {
      // Remove custom theme style if switching to built-in
      const existingStyle = document.getElementById('custom-theme-active')
      if (existingStyle) {
        existingStyle.remove()
      }
    }
  }, [currentTheme, customThemes])

  return <>{children}</>
}
