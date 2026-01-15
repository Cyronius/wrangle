import { marked, Marked, Renderer, Tokens } from 'marked'
import { markedHighlight } from 'marked-highlight'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import matter from 'gray-matter'
import { SourceMap, SourceRange } from './source-map'

export { SourceMap }

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
 * Render front matter data as a collapsible details element
 */
function renderFrontMatter(data: Record<string, unknown>): string {
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

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Configure marked with extensions
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    }
  })
)

// Add GFM heading IDs for better navigation
marked.use(gfmHeadingId())

// Configure marked options
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: false, // Don't convert \n to <br>
  pedantic: false,
  smartLists: true,
  smartypants: false
})

/**
 * Process KaTeX math expressions
 * Converts $...$ for inline and $$...$$ for block math
 */
function processMath(html: string): string {
  // Process block math first ($$...$$)
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      const katex = (window as any).katex
      if (!katex) return `$$${math}$$`
      return `<div class="math-block">${katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false
      })}</div>`
    } catch (e) {
      return `<div class="math-error">Math Error: ${math}</div>`
    }
  })

  // Process inline math ($...$)
  html = html.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      const katex = (window as any).katex
      if (!katex) return `$${math}$`
      return katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false
      })
    } catch (e) {
      return `<span class="math-error">${math}</span>`
    }
  })

  return html
}

/**
 * Transform relative image paths to data URLs by reading them from disk
 */
async function transformImagePaths(html: string, baseDir: string): Promise<string> {
  console.log('[transformImagePaths] baseDir:', baseDir)
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const images = doc.querySelectorAll('img')

  console.log('[transformImagePaths] Found', images.length, 'images')

  // Process images sequentially to avoid race conditions
  for (const img of Array.from(images)) {
    const src = img.getAttribute('src')
    console.log('[transformImagePaths] Original src:', src)

    if (src && src.startsWith('./')) {
      // Remove leading ./
      const relativePath = src.substring(2)
      // Combine with base directory (use platform-specific path separator)
      const absolutePath = `${baseDir}\\${relativePath.replace(/\//g, '\\')}`

      console.log('[transformImagePaths] Absolute path:', absolutePath)

      try {
        // Read image as data URL through IPC
        const dataURL = await window.electron.file.readImageAsDataURL(absolutePath)

        if (dataURL) {
          console.log('[transformImagePaths] Converted to data URL (length:', dataURL.length, ')')
          img.setAttribute('src', dataURL)
        } else {
          console.error('[transformImagePaths] Failed to convert image:', absolutePath)
        }
      } catch (error) {
        console.error('[transformImagePaths] Error loading image:', error)
      }
    }
  }

  return doc.body.innerHTML
}

/**
 * Process Mermaid diagrams
 * Detects ```mermaid code blocks and renders them
 */
async function processMermaid(html: string): Promise<string> {
  const mermaid = (window as any).mermaid
  if (!mermaid) return html

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const codeBlocks = doc.querySelectorAll('code.language-mermaid')

  for (let i = 0; i < codeBlocks.length; i++) {
    const codeBlock = codeBlocks[i]
    const pre = codeBlock.parentElement

    if (pre && pre.tagName === 'PRE') {
      const mermaidCode = codeBlock.textContent || ''
      try {
        const { svg } = await mermaid.render(`mermaid-${Date.now()}-${i}`, mermaidCode)
        const div = doc.createElement('div')
        div.className = 'mermaid-diagram'
        div.innerHTML = svg
        pre.replaceWith(div)
      } catch (e) {
        const errorDiv = doc.createElement('div')
        errorDiv.className = 'mermaid-error'
        errorDiv.textContent = `Mermaid Error: ${(e as Error).message}`
        pre.replaceWith(errorDiv)
      }
    }
  }

  return doc.body.innerHTML
}

/**
 * Main markdown rendering function
 * Converts markdown to sanitized HTML with all extensions
 */
export async function renderMarkdown(
  markdown: string,
  baseDir: string | null = null
): Promise<string> {
  try {
    console.log('[renderMarkdown] Called with baseDir:', baseDir)

    // Extract front matter
    const { content: markdownContent, data: frontMatterData, hasFrontMatter } = extractFrontMatter(markdown)

    // Convert markdown to HTML
    let html = await marked.parse(markdownContent)

    // Prepend front matter if present
    if (hasFrontMatter) {
      html = renderFrontMatter(frontMatterData) + html
    }

    // Process KaTeX math expressions
    html = processMath(html)

    // Process Mermaid diagrams
    html = await processMermaid(html)

    // Transform image paths if we have a base directory
    if (baseDir) {
      console.log('[renderMarkdown] Calling transformImagePaths with baseDir:', baseDir)
      html = await transformImagePaths(html, baseDir)
    } else {
      console.log('[renderMarkdown] No baseDir provided, skipping image path transformation')
    }

    // Sanitize HTML to prevent XSS
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'em', 'del', 'code', 'pre',
        'ul', 'ol', 'li',
        'blockquote',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'a', 'img',
        'div', 'span',
        'input', // For task lists
        'details', 'summary', // For front matter
        'svg', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'text', 'g', 'defs', 'marker' // For mermaid
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'alt', 'src',
        'class', 'id',
        'type', 'checked', 'disabled', // For task lists
        'open', // For details element
        'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'style', 'marker-end', 'marker-start' // For mermaid
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    })

    return sanitized
  } catch (error) {
    console.error('Markdown rendering error:', error)
    return `<div class="render-error">Error rendering markdown: ${(error as Error).message}</div>`
  }
}

/**
 * Initialize Mermaid with configuration
 */
export function initializeMermaid(): void {
  const mermaid = (window as any).mermaid
  if (mermaid) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict'
    })
  }
}

/**
 * Creates source mapping extensions for marked.js v12
 * Uses extension array with renderer functions that receive full token objects
 */
function createSourceMappingRenderer(markdown: string): {
  extensions: Array<{ name: string; renderer: (token: any) => string | false }>
  walkTokens: (token: any) => void
  getSourceMap: () => SourceMap
} {
  const sourceMap = new SourceMap()

  // Build source map during token walking (before rendering)
  function walkTokens(token: any): void {
    if (token.raw && ['heading', 'paragraph', 'blockquote', 'list', 'code', 'table'].includes(token.type)) {
      const index = markdown.indexOf(token.raw)
      if (index !== -1) {
        const id = sourceMap.addEntry(token.type, { start: index, end: index + token.raw.length })
        // Store the source ID on the token for use during rendering
        token._sourceId = id
        console.log('[walkTokens] Added entry:', id, 'type:', token.type, 'range:', index, '-', index + token.raw.length)
      }
    }
  }

  // Extension array - each extension has a name (token type) and renderer function
  // Renderer receives full token object and has access to this.parser
  const extensions = [
    {
      name: 'heading',
      renderer: function(this: { parser: any }, token: any): string {
        const sourceId = token._sourceId
        const text = this.parser.parseInline(token.tokens)
        const attr = sourceId ? ` data-source-id="${sourceId}"` : ''
        console.log('[ext-renderer] heading:', { sourceId, depth: token.depth, raw: token.raw?.substring(0, 30) })
        return `<h${token.depth}${attr}>${text}</h${token.depth}>\n`
      }
    },
    {
      name: 'paragraph',
      renderer: function(this: { parser: any }, token: any): string {
        const sourceId = token._sourceId
        const text = this.parser.parseInline(token.tokens)
        const attr = sourceId ? ` data-source-id="${sourceId}"` : ''
        console.log('[ext-renderer] paragraph:', { sourceId, raw: token.raw?.substring(0, 30) })
        return `<p${attr}>${text}</p>\n`
      }
    },
    {
      name: 'blockquote',
      renderer: function(this: { parser: any }, token: any): string {
        const sourceId = token._sourceId
        const body = this.parser.parse(token.tokens)
        const attr = sourceId ? ` data-source-id="${sourceId}"` : ''
        return `<blockquote${attr}>\n${body}</blockquote>\n`
      }
    },
    {
      name: 'list',
      renderer: function(this: { parser: any }, token: any): string {
        const sourceId = token._sourceId
        const tag = token.ordered ? 'ol' : 'ul'
        const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : ''
        const attr = sourceId ? ` data-source-id="${sourceId}"` : ''

        let body = ''
        for (const item of token.items) {
          let itemBody = ''
          if (item.task) {
            const checkbox = `<input type="checkbox" ${item.checked ? 'checked' : ''} disabled> `
            itemBody = checkbox + this.parser.parseInline(item.tokens)
          } else {
            itemBody = this.parser.parse(item.tokens)
          }
          body += `<li>${itemBody}</li>\n`
        }

        return `<${tag}${startAttr}${attr}>\n${body}</${tag}>\n`
      }
    },
    {
      name: 'code',
      renderer: function(this: { parser: any }, token: any): string {
        const sourceId = token._sourceId
        const lang = (token.lang || '').match(/^\S*/)?.[0] || ''
        const language = hljs.getLanguage(lang) ? lang : 'plaintext'
        const highlighted = hljs.highlight(token.text, { language }).value
        const attr = sourceId ? ` data-source-id="${sourceId}"` : ''
        return `<pre${attr}><code class="hljs language-${language}">${highlighted}</code></pre>\n`
      }
    },
    {
      name: 'table',
      renderer: function(this: { parser: any }, token: any): string {
        const sourceId = token._sourceId
        const attr = sourceId ? ` data-source-id="${sourceId}"` : ''

        // Header
        let headerCells = ''
        for (const cell of token.header) {
          const alignAttr = cell.align ? ` align="${cell.align}"` : ''
          headerCells += `<th${alignAttr}>${this.parser.parseInline(cell.tokens)}</th>`
        }
        const headerHtml = `<thead><tr>${headerCells}</tr></thead>`

        // Body
        let bodyRows = ''
        for (const row of token.rows) {
          let cells = ''
          for (const cell of row) {
            const alignAttr = cell.align ? ` align="${cell.align}"` : ''
            cells += `<td${alignAttr}>${this.parser.parseInline(cell.tokens)}</td>`
          }
          bodyRows += `<tr>${cells}</tr>\n`
        }
        const bodyHtml = `<tbody>${bodyRows}</tbody>`

        return `<table${attr}>${headerHtml}${bodyHtml}</table>\n`
      }
    }
  ]

  return {
    extensions,
    walkTokens,
    getSourceMap: () => sourceMap
  }
}

/**
 * Render markdown with source mapping support
 * Returns both HTML and a source map for preview-to-editor selection
 */
export async function renderMarkdownWithSourceMap(
  markdown: string,
  baseDir: string | null = null
): Promise<{ html: string; sourceMap: SourceMap }> {
  // Create source mapping extensions
  const { extensions, walkTokens, getSourceMap } = createSourceMappingRenderer(markdown)

  // Create a new Marked instance to avoid polluting the global marked state
  const markedInstance = new Marked()

  // Configure the instance with the same extensions as the global one
  markedInstance.use(
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext'
        return hljs.highlight(code, { language }).value
      }
    })
  )
  markedInstance.use(gfmHeadingId())
  markedInstance.setOptions({
    gfm: true,
    breaks: false,
    pedantic: false,
    smartLists: true,
    smartypants: false
  })

  // Use walkTokens to build source map, and extension renderers to add data-source-id attributes
  markedInstance.use({ walkTokens, extensions })

  try {
    // Extract front matter
    const { content: markdownContent, data: frontMatterData, hasFrontMatter } = extractFrontMatter(markdown)
    console.log('[renderMarkdownWithSourceMap] markdownContent length:', markdownContent.length)

    let html = await markedInstance.parse(markdownContent)
    console.log('[renderMarkdownWithSourceMap] after parse, sourceMap size:', getSourceMap().size)

    // Prepend front matter if present
    if (hasFrontMatter) {
      html = renderFrontMatter(frontMatterData) + html
    }

    // Process KaTeX math expressions
    html = processMath(html)

    // Process Mermaid diagrams
    html = await processMermaid(html)

    // Transform image paths if we have a base directory
    if (baseDir) {
      html = await transformImagePaths(html, baseDir)
    }

    // Sanitize HTML to prevent XSS - whitelist data-source-id attribute
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'strong', 'em', 'del', 'code', 'pre',
        'ul', 'ol', 'li',
        'blockquote',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'a', 'img',
        'div', 'span',
        'input',
        'details', 'summary', // For front matter
        'svg', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'text', 'g', 'defs', 'marker'
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'alt', 'src',
        'class', 'id',
        'type', 'checked', 'disabled',
        'open', // For details element
        'data-source-id', // Source mapping attribute
        'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'style', 'marker-end', 'marker-start'
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    })

    return { html: sanitized, sourceMap: getSourceMap() }
  } catch (error) {
    console.error('Markdown rendering error:', error)
    return {
      html: `<div class="render-error">Error rendering markdown: ${(error as Error).message}</div>`,
      sourceMap: new SourceMap()
    }
  }
}
