/**
 * Utility functions for markdown processing.
 *
 * Note: The main markdown rendering is now handled by react-markdown in MarkdownPreview.
 * This file contains utility functions for front matter extraction and rendering.
 */

/**
 * Simple YAML front matter parser that works in the browser.
 * Parses basic YAML key-value pairs from front matter delimited by ---.
 */
function parseYaml(yamlContent: string): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const lines = yamlContent.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmed.substring(0, colonIndex).trim()
    let value: unknown = trimmed.substring(colonIndex + 1).trim()

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    // Try to parse as number or boolean
    if (value === 'true') value = true
    else if (value === 'false') value = false
    else if (value === 'null') value = null
    else if (!isNaN(Number(value)) && value !== '') value = Number(value)

    if (key) {
      data[key] = value
    }
  }

  return data
}

/**
 * Extract and process YAML front matter from markdown content
 * Returns the content without front matter and the parsed data
 */
export function extractFrontMatter(markdown: string): {
  content: string
  data: Record<string, unknown>
  hasFrontMatter: boolean
} {
  try {
    // Check for front matter delimiter at start
    if (!markdown.startsWith('---')) {
      return {
        content: markdown,
        data: {},
        hasFrontMatter: false
      }
    }

    // Find closing delimiter
    const endIndex = markdown.indexOf('---', 3)
    if (endIndex === -1) {
      return {
        content: markdown,
        data: {},
        hasFrontMatter: false
      }
    }

    // Extract YAML content between delimiters
    const yamlContent = markdown.substring(3, endIndex).trim()
    const data = parseYaml(yamlContent)

    // Get content after front matter (skip the closing --- and any following newline)
    let contentStart = endIndex + 3
    if (markdown[contentStart] === '\n') contentStart++
    if (markdown[contentStart] === '\r') contentStart++
    if (markdown[contentStart] === '\n') contentStart++

    return {
      content: markdown.substring(contentStart),
      data,
      hasFrontMatter: Object.keys(data).length > 0
    }
  } catch (e) {
    // If parsing fails, return original content
    console.warn('Failed to parse front matter:', e)
    return {
      content: markdown,
      data: {},
      hasFrontMatter: false
    }
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Render front matter data as a collapsible details element
 */
export function renderFrontMatter(data: Record<string, unknown>): string {
  if (Object.keys(data).length === 0) return ''

  const rows = Object.entries(data).map(([key, value]) => {
    const valueStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
    return `<tr><td><strong>${escapeHtml(key)}</strong></td><td>${escapeHtml(valueStr)}</td></tr>`
  }).join('')

  return `
    <details class="front-matter">
      <summary>Front Matter</summary>
      <table class="front-matter-table">
        <tbody>${rows}</tbody>
      </table>
    </details>
  `
}
