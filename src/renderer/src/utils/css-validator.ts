/**
 * Validates CSS content for theme editing
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate CSS syntax and structure for a theme
 */
export function validateThemeCSS(css: string): ValidationResult {
  const errors: string[] = []

  if (!css.trim()) {
    return { valid: false, errors: ['CSS content is empty'] }
  }

  // Check for balanced braces
  let braceCount = 0
  for (const char of css) {
    if (char === '{') braceCount++
    if (char === '}') braceCount--
    if (braceCount < 0) {
      errors.push('Unbalanced braces: extra closing brace found')
      break
    }
  }
  if (braceCount > 0) {
    errors.push('Unbalanced braces: missing closing brace')
  }

  // Check for :root[data-theme='...'] selector
  const themeSelector = /:root\[data-theme=['"][^'"]+['"]\]/
  if (!themeSelector.test(css)) {
    errors.push("Theme CSS must include a :root[data-theme='themename'] selector")
  }

  // Try to parse CSS using the browser's CSS parser
  try {
    const styleSheet = new CSSStyleSheet()
    styleSheet.replaceSync(css)

    // Check for any invalid rules
    if (styleSheet.cssRules.length === 0) {
      errors.push('No valid CSS rules found')
    }
  } catch (e) {
    errors.push(`CSS syntax error: ${(e as Error).message}`)
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Extract the theme name from CSS content
 */
export function extractThemeName(css: string): string | null {
  const match = css.match(/:root\[data-theme=['"]([^'"]+)['"]\]/)
  return match ? match[1] : null
}

/**
 * Generate a CSS template for a new theme
 */
export function generateThemeTemplate(themeName: string, basedOn: 'light' | 'dark' = 'dark'): string {
  if (basedOn === 'light') {
    return `:root[data-theme='${themeName}'] {
  /* App background and text */
  --app-bg: #faf8f5;
  --text-color: #1a1a1a;
  --text-color-active: #000000;
  --text-color-muted: #6a6a6a;
  --border-color: #e1ddd8;

  /* Tab bar */
  --tab-bar-bg: #f5f2ed;
  --tab-bg: #f5f2ed;
  --tab-hover-bg: #ebe7e2;
  --tab-active-bg: #faf8f5;
  --tab-close-hover-bg: #ddd9d4;
  --tab-close-active-bg: #ccc8c3;

  /* Toolbar */
  --toolbar-bg: #f5f2ed;
  --toolbar-border: #e1ddd8;
  --button-bg: #faf8f5;
  --button-hover-bg: #ebe7e2;
  --button-active-bg: #ddd9d4;

  /* Preview */
  --preview-bg: #faf8f5;
  --preview-text: #1a1a1a;
  --preview-heading: #1a1a1a;
  --preview-text-muted: #6a6a6a;
  --preview-border: #e1ddd8;
  --preview-link: #0969da;
  --preview-code-bg: rgba(175, 168, 155, 0.2);
  --preview-code-block-bg: #f5f2ed;
  --preview-table-header-bg: #f5f2ed;
  --preview-table-row-alt-bg: #f5f2ed;

  /* Accent color */
  --accent-color: #0969da;

  /* Scrollbar */
  --scrollbar-thumb: #ccc8c3;
  --scrollbar-thumb-hover: #b4b0ab;

  /* Monaco Editor - uncomment and customize for full control */
  /* --monaco-editor-bg: #faf8f5; */
  /* --monaco-editor-fg: #1a1a1a; */
  /* --monaco-line-number: #6a6a6a; */
  /* --monaco-line-number-active: #1a1a1a; */
  /* --monaco-selection-bg: rgba(9, 105, 218, 0.2); */
  /* --monaco-cursor: #1a1a1a; */
  /* --monaco-token-comment: #6a737d; */
  /* --monaco-token-string: #032f62; */
  /* --monaco-token-keyword: #d73a49; */
  /* --monaco-token-number: #005cc5; */
  /* --monaco-token-operator: #d73a49; */
  /* --monaco-token-function: #6f42c1; */
  /* --monaco-token-variable: #e36209; */
}
`
  }

  return `:root[data-theme='${themeName}'] {
  /* App background and text */
  --app-bg: #1e1e1e;
  --text-color: #d4d4d4;
  --text-color-active: #ffffff;
  --text-color-muted: #8b8b8b;
  --border-color: #3c3c3c;

  /* Tab bar */
  --tab-bar-bg: #252526;
  --tab-bg: #2d2d30;
  --tab-hover-bg: #3c3c3c;
  --tab-active-bg: #1e1e1e;
  --tab-close-hover-bg: #4a4a4a;
  --tab-close-active-bg: #5a5a5a;

  /* Toolbar */
  --toolbar-bg: #252526;
  --toolbar-border: #3c3c3c;
  --button-bg: #3c3c3c;
  --button-hover-bg: #4a4a4a;
  --button-active-bg: #5a5a5a;

  /* Preview */
  --preview-bg: #1e1e1e;
  --preview-text: #d4d4d4;
  --preview-heading: #ffffff;
  --preview-text-muted: #8b8b8b;
  --preview-border: #3c3c3c;
  --preview-link: #4daafc;
  --preview-code-bg: rgba(110, 118, 129, 0.4);
  --preview-code-block-bg: #2d2d30;
  --preview-table-header-bg: #2d2d30;
  --preview-table-row-alt-bg: #252526;

  /* Accent color */
  --accent-color: #4daafc;

  /* Scrollbar */
  --scrollbar-thumb: #424242;
  --scrollbar-thumb-hover: #4e4e4e;

  /* Monaco Editor - uncomment and customize for full control */
  /* --monaco-editor-bg: #1e1e1e; */
  /* --monaco-editor-fg: #d4d4d4; */
  /* --monaco-line-number: #858585; */
  /* --monaco-line-number-active: #c6c6c6; */
  /* --monaco-selection-bg: #264f78; */
  /* --monaco-cursor: #aeafad; */
  /* --monaco-token-comment: #6a9955; */
  /* --monaco-token-string: #ce9178; */
  /* --monaco-token-keyword: #569cd6; */
  /* --monaco-token-number: #b5cea8; */
  /* --monaco-token-operator: #d4d4d4; */
  /* --monaco-token-function: #dcdcaa; */
  /* --monaco-token-variable: #9cdcfe; */
}
`
}
