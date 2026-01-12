import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store/store'
import '../styles/themes/dark.css'
import '../styles/themes/light.css'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSelector((state: RootState) => state.theme.currentTheme)

  useEffect(() => {
    // Apply theme to root element - CSS is already loaded via imports
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return <>{children}</>
}
