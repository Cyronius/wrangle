import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Editor } from '@monaco-editor/react'
import { AppDispatch, RootState } from '../../store/store'
import {
  setCurrentTheme,
  addCustomTheme,
  updateCustomTheme,
  deleteCustomTheme,
  saveThemeSettings
} from '../../store/settingsSlice'
import { validateThemeCSS, generateThemeTemplate } from '../../utils/css-validator'
import { registerCustomMonacoTheme } from '../../utils/monaco-theme-generator'
import { useDebounce } from '../../hooks/useKeyboardShortcuts'

import { builtInThemes } from '../../styles/themes'

export function ThemeEditorTab() {
  const dispatch = useDispatch<AppDispatch>()
  const { current: currentTheme, customThemes } = useSelector(
    (state: RootState) => state.settings.theme
  )

  const [editedCSS, setEditedCSS] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showNewThemeModal, setShowNewThemeModal] = useState(false)
  const [newThemeName, setNewThemeName] = useState('')
  const [baseTheme, setBaseTheme] = useState<'light' | 'dark'>('dark')
  const [copySourceCSS, setCopySourceCSS] = useState<string | null>(null)

  // Ref to avoid stale closure in debounced save
  const currentThemeRef = useRef(currentTheme)
  useEffect(() => { currentThemeRef.current = currentTheme }, [currentTheme])

  // Check if current theme is built-in
  const isBuiltIn = !!builtInThemes[currentTheme]

  // Get all theme names
  const allThemeNames = useMemo(() => {
    return [...Object.keys(builtInThemes), ...Object.keys(customThemes)]
  }, [customThemes])

  // Get CSS for current theme
  const currentCSS = useMemo(() => {
    if (builtInThemes[currentTheme]) {
      return builtInThemes[currentTheme]
    }
    return customThemes[currentTheme] || ''
  }, [currentTheme, customThemes])

  // Initialize edited CSS when theme changes
  useEffect(() => {
    setEditedCSS(currentCSS)
    setValidationErrors([])
  }, [currentTheme, currentCSS])

  // Debounced save for custom themes - captures theme name at call time
  const debouncedSave = useDebounce(
    useCallback(
      (css: string, themeAtCallTime: string) => {
        // Use the theme name from when the change was made, not current
        const theme = themeAtCallTime
        if (!!builtInThemes[theme]) return

        const result = validateThemeCSS(css)
        setValidationErrors(result.errors)

        if (result.valid) {
          dispatch(updateCustomTheme({ name: theme, css }))
          registerCustomMonacoTheme(theme, css)
          dispatch(saveThemeSettings())
        }
      },
      [dispatch]
    ),
    1500
  )

  // Handle CSS change
  const handleCSSChange = (value: string | undefined) => {
    const css = value || ''
    setEditedCSS(css)
    // Capture current theme at the time of the change
    debouncedSave(css, currentThemeRef.current)
  }

  // Handle theme selection change
  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const themeName = e.target.value
    dispatch(setCurrentTheme(themeName))

    // Save to persistent storage (reads current state internally)
    dispatch(saveThemeSettings())
  }

  // Create new theme
  const handleCreateTheme = () => {
    const name = newThemeName.trim()
    if (!name) return

    // Check if name already exists
    if (allThemeNames.includes(name)) {
      alert('A theme with this name already exists')
      return
    }

    // Use copied CSS if available and valid, otherwise generate template
    let css: string
    if (copySourceCSS && copySourceCSS.includes('--app-bg')) {
      // Replace the data-theme selector with the new theme name
      css = copySourceCSS.replace(
        /:root\[data-theme=['"][^'"]+['"]\]/g,
        `:root[data-theme='${name}']`
      )
    } else {
      css = generateThemeTemplate(name, baseTheme)
    }

    dispatch(addCustomTheme({ name, css }))
    dispatch(setCurrentTheme(name))

    // Directly apply the theme CSS to avoid race with ThemeProvider
    applyCustomThemeCSS(name, css)

    // Register Monaco theme
    registerCustomMonacoTheme(name, css)

    // Save to persistent storage (reads current state internally)
    dispatch(saveThemeSettings())

    setShowNewThemeModal(false)
    setNewThemeName('')
    setCopySourceCSS(null)
  }

  // Copy current theme
  const handleCopyTheme = () => {
    const baseName = currentTheme.replace(/-copy\d*$/, '')
    setNewThemeName(`${baseName}-copy`)
    // Use editedCSS (what's visible in the editor) as primary source,
    // falling back to currentCSS from Redux/built-in registry
    const sourceCSS = editedCSS || currentCSS
    setCopySourceCSS(sourceCSS)
    // Detect if source is light-based by checking background color value
    const isLightBased = sourceCSS.includes('#faf8f5') || sourceCSS.includes('#ffffff') ||
      currentTheme === 'light' || currentTheme.toLowerCase().includes('light')
    setBaseTheme(isLightBased ? 'light' : 'dark')
    setShowNewThemeModal(true)
  }

  // Delete custom theme
  const handleDeleteTheme = () => {
    if (isBuiltIn) return
    if (confirm(`Delete theme "${currentTheme}"?`)) {
      dispatch(deleteCustomTheme(currentTheme))

      // Save to persistent storage (reads current state internally)
      dispatch(saveThemeSettings())
    }
  }

  // Apply current custom theme to app
  const handleApplyTheme = () => {
    if (isBuiltIn) return

    const result = validateThemeCSS(editedCSS)
    if (!result.valid) {
      setValidationErrors(result.errors)
      return
    }

    // Inject custom CSS into document
    applyCustomThemeCSS(currentTheme, editedCSS)

    // Register Monaco theme
    registerCustomMonacoTheme(currentTheme, editedCSS)
  }

  return (
    <div className="theme-tab">
      {/* Controls */}
      <div className="theme-controls">
        <div className="theme-select">
          <select value={currentTheme} onChange={handleThemeChange}>
            {allThemeNames.map((name) => (
              <option key={name} value={name}>
                {name}
                {builtInThemes[name] ? ' (built-in)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="theme-actions">
          <button
            className="shortcuts-btn"
            onClick={() => {
              setNewThemeName('')
              setBaseTheme('dark')
              setCopySourceCSS(null)
              setShowNewThemeModal(true)
            }}
            title="Create a new theme from template"
          >
            New Theme
          </button>
          <button
            className="shortcuts-btn"
            onClick={handleCopyTheme}
            title="Create a copy of current theme"
          >
            Copy Theme
          </button>
          {!isBuiltIn && (
            <>
              <button
                className="shortcuts-btn primary"
                onClick={handleApplyTheme}
                title="Apply theme changes"
              >
                Apply
              </button>
              <button
                className="shortcuts-btn danger"
                onClick={handleDeleteTheme}
                title="Delete this custom theme"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Read-only notice for built-in themes */}
      {isBuiltIn && (
        <div className="theme-readonly-notice">
          Built-in themes are read-only. Click "New Theme" or "Copy Theme" to create a
          customizable theme.
        </div>
      )}

      {/* CSS Editor */}
      <div className="theme-editor-container">
        <Editor
          height="100%"
          defaultLanguage="css"
          theme="vs-dark"
          value={editedCSS}
          onChange={handleCSSChange}
          options={{
            readOnly: isBuiltIn,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2
          }}
        />
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="theme-validation-error">
          <strong>Validation Errors:</strong>
          <ul>
            {validationErrors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* New theme modal */}
      {showNewThemeModal && (
        <div
          className="name-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowNewThemeModal(false)}
        >
          <div className="name-modal">
            <h3>New Theme</h3>
            <input
              type="text"
              placeholder="Theme name"
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTheme()}
              autoFocus
            />
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-color)' }}>
                Based on:
              </label>
              <select
                value={baseTheme}
                onChange={(e) => setBaseTheme(e.target.value as 'light' | 'dark')}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--button-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 4,
                  color: 'var(--text-color)'
                }}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
            <div className="name-modal-actions">
              <button
                className="shortcuts-btn"
                onClick={() => setShowNewThemeModal(false)}
              >
                Cancel
              </button>
              <button
                className="shortcuts-btn primary"
                onClick={handleCreateTheme}
                disabled={!newThemeName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Inject custom theme CSS into the document
 */
function applyCustomThemeCSS(themeName: string, css: string): void {
  // Remove existing custom style element if present
  const existingStyle = document.getElementById(`custom-theme-${themeName}`)
  if (existingStyle) {
    existingStyle.remove()
  }

  // Create and inject new style element
  const style = document.createElement('style')
  style.id = `custom-theme-${themeName}`
  style.textContent = css
  document.head.appendChild(style)

  // Update data-theme attribute
  document.documentElement.setAttribute('data-theme', themeName)
}
