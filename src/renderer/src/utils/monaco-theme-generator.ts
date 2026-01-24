import * as monaco from 'monaco-editor'

/**
 * Monaco theme token color definitions
 */
interface MonacoThemeColors {
  editorBg: string
  editorFg: string
  lineNumber: string
  lineNumberActive: string
  selectionBg: string
  cursor: string
  comment: string
  string: string
  keyword: string
  number: string
  operator: string
  function: string
  variable: string
}

/**
 * Extract Monaco CSS variables from CSS content
 */
export function extractMonacoVariables(css: string): Partial<MonacoThemeColors> {
  const colors: Partial<MonacoThemeColors> = {}

  const varMappings: Record<string, keyof MonacoThemeColors> = {
    '--monaco-editor-bg': 'editorBg',
    '--monaco-editor-fg': 'editorFg',
    '--monaco-line-number': 'lineNumber',
    '--monaco-line-number-active': 'lineNumberActive',
    '--monaco-selection-bg': 'selectionBg',
    '--monaco-cursor': 'cursor',
    '--monaco-token-comment': 'comment',
    '--monaco-token-string': 'string',
    '--monaco-token-keyword': 'keyword',
    '--monaco-token-number': 'number',
    '--monaco-token-operator': 'operator',
    '--monaco-token-function': 'function',
    '--monaco-token-variable': 'variable'
  }

  for (const [cssVar, colorKey] of Object.entries(varMappings)) {
    // Match both quoted and unquoted values
    const regex = new RegExp(`${cssVar}:\\s*([^;]+);`)
    const match = css.match(regex)
    if (match) {
      colors[colorKey] = match[1].trim()
    }
  }

  return colors
}

/**
 * Generate a Monaco theme definition from color values
 */
export function generateMonacoTheme(
  themeName: string,
  colors: Partial<MonacoThemeColors>,
  base: 'vs' | 'vs-dark' = 'vs-dark'
): monaco.editor.IStandaloneThemeData {
  // Default colors based on base theme
  const defaults: MonacoThemeColors =
    base === 'vs-dark'
      ? {
          editorBg: '#1e1e1e',
          editorFg: '#d4d4d4',
          lineNumber: '#858585',
          lineNumberActive: '#c6c6c6',
          selectionBg: '#264f78',
          cursor: '#aeafad',
          comment: '#6a9955',
          string: '#ce9178',
          keyword: '#569cd6',
          number: '#b5cea8',
          operator: '#d4d4d4',
          function: '#dcdcaa',
          variable: '#9cdcfe'
        }
      : {
          editorBg: '#ffffff',
          editorFg: '#000000',
          lineNumber: '#237893',
          lineNumberActive: '#000000',
          selectionBg: '#add6ff',
          cursor: '#000000',
          comment: '#008000',
          string: '#a31515',
          keyword: '#0000ff',
          number: '#098658',
          operator: '#000000',
          function: '#795e26',
          variable: '#001080'
        }

  // Merge with provided colors
  const merged = { ...defaults, ...colors }

  return {
    base,
    inherit: true,
    rules: [
      { token: 'comment', foreground: merged.comment.replace('#', '') },
      { token: 'string', foreground: merged.string.replace('#', '') },
      { token: 'keyword', foreground: merged.keyword.replace('#', '') },
      { token: 'number', foreground: merged.number.replace('#', '') },
      { token: 'operator', foreground: merged.operator.replace('#', '') },
      { token: 'type', foreground: merged.keyword.replace('#', '') },
      { token: 'function', foreground: merged.function.replace('#', '') },
      { token: 'variable', foreground: merged.variable.replace('#', '') },
      { token: 'identifier', foreground: merged.editorFg.replace('#', '') },
      // Markdown-specific tokens
      { token: 'emphasis', fontStyle: 'italic' },
      { token: 'strong', fontStyle: 'bold' },
      { token: 'keyword.md', foreground: merged.keyword.replace('#', '') },
      { token: 'string.link.md', foreground: merged.string.replace('#', '') }
    ],
    colors: {
      'editor.background': merged.editorBg,
      'editor.foreground': merged.editorFg,
      'editorLineNumber.foreground': merged.lineNumber,
      'editorLineNumber.activeForeground': merged.lineNumberActive,
      'editor.selectionBackground': merged.selectionBg,
      'editorCursor.foreground': merged.cursor,
      'editor.lineHighlightBackground': `${merged.selectionBg}33`,
      'editorWhitespace.foreground': '#3c3c3c'
    }
  }
}

/**
 * Determine if a hex color is light based on perceived luminance
 */
function isLightColor(hex: string): boolean {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5
}

/**
 * Sanitize a theme name to be compatible with Monaco's defineTheme.
 * Monaco only allows alphanumeric characters and hyphens (/^[a-z0-9\-]+$/i).
 */
function sanitizeMonacoThemeName(name: string): string {
  return name.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
}

/**
 * Register a custom Monaco theme from CSS content
 */
export function registerCustomMonacoTheme(themeName: string, css: string): boolean {
  try {
    const colors = extractMonacoVariables(css)

    // Determine base theme from editor background luminance
    const editorBg = colors.editorBg || '#1e1e1e'
    const base = isLightColor(editorBg) ? 'vs' : 'vs-dark'

    const sanitizedName = sanitizeMonacoThemeName(themeName)
    const theme = generateMonacoTheme(sanitizedName, colors, base)
    monaco.editor.defineTheme(sanitizedName, theme)
    return true
  } catch (e) {
    console.error('Failed to register Monaco theme:', e)
    return false
  }
}

/**
 * Get the appropriate Monaco theme name for a theme
 */
export function getMonacoThemeName(themeName: string): string {
  // Built-in themes map to Monaco's default themes
  if (themeName === 'Lightish') return 'vs'
  if (themeName === 'Dark') return 'vs-dark'

  // Custom themes use their sanitized name (must be registered first)
  return sanitizeMonacoThemeName(themeName)
}
