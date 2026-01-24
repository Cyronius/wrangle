import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store/store'
import { builtInThemeNames } from '../styles/themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const currentTheme = useSelector((state: RootState) => state.settings.theme.current)
  const customThemes = useSelector((state: RootState) => state.settings.theme.customThemes)

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
    // If custom theme not yet in Redux, don't change data-theme attribute
    // (avoids falling back to dark defaults from global.css)
  }, [currentTheme, customThemes])

  return <>{children}</>
}
