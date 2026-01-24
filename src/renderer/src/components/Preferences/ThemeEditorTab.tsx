import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Editor } from '@monaco-editor/react'
import { AppDispatch, RootState } from '../../store/store'
import {
  setCurrentTheme,
  addCustomTheme,
  updateCustomTheme,
  deleteCustomTheme,
  renameCustomTheme,
  saveThemeSettings
} from '../../store/settingsSlice'
import { validateThemeCSS, generateThemeTemplate } from '../../utils/css-validator'
import { registerCustomMonacoTheme, getMonacoThemeName } from '../../utils/monaco-theme-generator'
import { useDebounce } from '../../hooks/useKeyboardShortcuts'

import { builtInThemes } from '../../styles/themes'

function getNextCopyName(baseName: string, existingNames: string[]): string {
  const candidate = `${baseName}-copy`
  if (!existingNames.includes(candidate)) return candidate
  let n = 2
  while (existingNames.includes(`${baseName}-copy ${n}`)) n++
  return `${baseName}-copy ${n}`
}

export function ThemeEditorTab() {
  const dispatch = useDispatch<AppDispatch>()
  const { current: currentTheme, customThemes } = useSelector(
    (state: RootState) => state.settings.theme
  )

  const [editedCSS, setEditedCSS] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Inline name editing state
  const [isEditingName, setIsEditingName] = useState(false)
  const [editingName, setEditingName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  // Intercept Escape key when inline editing name
  useEffect(() => {
    if (!isEditingName) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        e.preventDefault()
        setIsEditingName(false)
        setEditingName('')
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isEditingName])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingName && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [isEditingName])

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

  // Copy current theme immediately (no modal)
  const handleCopyTheme = () => {
    const baseName = currentTheme.replace(/-copy( \d+)?$/, '')
    const copyName = getNextCopyName(baseName, allThemeNames)

    // Use editedCSS (what's visible in the editor) as primary source
    const sourceCSS = editedCSS || currentCSS

    // Replace data-theme selector with new name
    let css: string
    if (sourceCSS && sourceCSS.includes('--app-bg')) {
      css = sourceCSS.replace(
        /:root\[data-theme=['"][^'"]+['"]\]/g,
        `:root[data-theme='${copyName}']`
      )
    } else {
      css = generateThemeTemplate(copyName, 'dark')
    }

    dispatch(addCustomTheme({ name: copyName, css }))
    dispatch(setCurrentTheme(copyName))
    applyCustomThemeCSS(copyName, css)
    registerCustomMonacoTheme(copyName, css)
    dispatch(saveThemeSettings())
  }

  // Save inline name edit
  const handleSaveName = () => {
    const newName = editingName.trim()
    if (!newName || newName === currentTheme) {
      setIsEditingName(false)
      setEditingName('')
      return
    }

    // Check for conflicts
    if (allThemeNames.includes(newName)) {
      return
    }

    // Update CSS and re-register
    const css = customThemes[currentTheme]
    if (css) {
      const updatedCSS = css.replace(
        /:root\[data-theme=['"][^'"]+['"]\]/g,
        `:root[data-theme='${newName}']`
      )
      registerCustomMonacoTheme(newName, updatedCSS)
      applyCustomThemeCSS(newName, updatedCSS)
    }

    dispatch(renameCustomTheme({ oldName: currentTheme, newName }))
    dispatch(saveThemeSettings())
    setIsEditingName(false)
    setEditingName('')
  }

  // Cancel inline name edit
  const handleCancelEdit = () => {
    setIsEditingName(false)
    setEditingName('')
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
          {isEditingName ? (
            <div className="theme-name-edit-container">
              <input
                ref={editInputRef}
                type="text"
                className="theme-name-edit-input"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                }}
              />
              <button
                className="theme-name-edit-btn cancel"
                onClick={handleCancelEdit}
                title="Cancel (Esc)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <button
                className="theme-name-edit-btn save"
                onClick={handleSaveName}
                title="Save (Enter)"
                disabled={!editingName.trim() || editingName.trim() === currentTheme || allThemeNames.includes(editingName.trim())}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="theme-select-with-edit">
              <select value={currentTheme} onChange={handleThemeChange}>
                <optgroup label="Built-in">
                  {Object.keys(builtInThemes).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </optgroup>
                {Object.keys(customThemes).length > 0 && (
                  <optgroup label="User Themes">
                    {Object.keys(customThemes).map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              {!isBuiltIn && (
                <button
                  className="theme-name-edit-btn pencil"
                  onClick={() => {
                    setEditingName(currentTheme)
                    setIsEditingName(true)
                  }}
                  title="Rename theme"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
              <button
                className="theme-name-edit-btn copy"
                onClick={handleCopyTheme}
                title="Copy theme"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="theme-actions">
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
          Built-in themes are read-only. Copy a theme to create a customizable version.
        </div>
      )}

      {/* CSS Editor */}
      <div className="theme-editor-container">
        <Editor
          height="100%"
          defaultLanguage="css"
          theme={getMonacoThemeName(currentTheme)}
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
