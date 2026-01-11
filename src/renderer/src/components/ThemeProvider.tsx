import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store/store'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSelector((state: RootState) => state.theme.currentTheme)

  useEffect(() => {
    // Apply theme to root element
    document.documentElement.setAttribute('data-theme', theme)

    // Dynamically import theme CSS
    const themeStyleId = 'theme-styles'
    let styleElement = document.getElementById(themeStyleId) as HTMLLinkElement

    if (!styleElement) {
      styleElement = document.createElement('link')
      styleElement.id = themeStyleId
      styleElement.rel = 'stylesheet'
      document.head.appendChild(styleElement)
    }

    // Update href to load the correct theme
    styleElement.href = `/src/styles/themes/${theme}.css`
  }, [theme])

  return <>{children}</>
}
