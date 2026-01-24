/**
 * Built-in theme registry.
 *
 * All .css files in this directory are automatically registered as built-in themes.
 * To add a new theme, simply create a new .css file with the format:
 *
 *   :root[data-theme='Theme Name'] { ... }
 *
 * The theme name is extracted from the data-theme selector in the CSS.
 */

// Import all theme CSS files as raw strings (for the editor display)
const themeModules = import.meta.glob('./*.css', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

// Import all theme CSS files as stylesheets (for applying to the document)
import.meta.glob('./*.css', { eager: true })

// Extract theme name from CSS content (from the data-theme selector)
function extractThemeName(css: string): string | null {
  const match = css.match(/:root\[data-theme=['"]([^'"]+)['"]\]/)
  return match ? match[1] : null
}

// Build the registry: theme name -> raw CSS string
const registry: Record<string, string> = {}

for (const [, css] of Object.entries(themeModules)) {
  const name = extractThemeName(css)
  if (name) {
    registry[name] = css
  }
}

/** All built-in theme names */
export const builtInThemeNames: Set<string> = new Set(Object.keys(registry))

/** Map of theme name -> raw CSS string for all built-in themes */
export const builtInThemes: Record<string, string> = registry
