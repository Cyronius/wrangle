/**
 * Utility functions for markdown processing.
 *
 * Note: The main markdown rendering is now handled by Streamdown in MarkdownPreview.
 * This file contains utility functions for front matter extraction and rendering.
 */

import matter from 'gray-matter'

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
    const result = matter(markdown)
    return {
      content: result.content,
      data: result.data as Record<string, unknown>,
      hasFrontMatter: Object.keys(result.data).length > 0
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
