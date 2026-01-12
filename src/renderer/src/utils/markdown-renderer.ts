import { marked, Marked, Renderer, Tokens } from 'marked'
import { markedHighlight } from 'marked-highlight'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import { SourceMap, SourceRange } from './source-map'

export { SourceMap }

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

    // Convert markdown to HTML
    let html = await marked.parse(markdown)

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
        'svg', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'text', 'g', 'defs', 'marker' // For mermaid
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'alt', 'src',
        'class', 'id',
        'type', 'checked', 'disabled', // For task lists
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
 * Custom renderer that adds source mapping attributes to HTML elements
 * Uses # private fields to prevent marked.js from enumerating them as renderer methods
 */
class SourceMappingRenderer extends Renderer {
  #sourceMap: SourceMap
  #markdown: string
  #searchOffset: number = 0

  constructor(markdown: string) {
    super()
    this.#markdown = markdown
    this.#sourceMap = new SourceMap()
  }

  #findSourceRange(raw: string): SourceRange | null {
    const index = this.#markdown.indexOf(raw, this.#searchOffset)
    if (index !== -1) {
      // Don't update searchOffset for inline elements to handle nested content
      return { start: index, end: index + raw.length }
    }
    return null
  }

  #addSourceAttr(html: string, type: string, raw: string): string {
    const range = this.#findSourceRange(raw)
    if (range) {
      const id = this.#sourceMap.addEntry(type, range)
      // Insert data-source-id attribute into the opening tag
      return html.replace(/^<(\w+)/, `<$1 data-source-id="${id}"`)
    }
    return html
  }

  // Override block-level elements
  heading({ tokens, depth, raw }: Tokens.Heading): string {
    const text = this.parser.parseInline(tokens)
    const html = `<h${depth}>${text}</h${depth}>\n`
    return this.#addSourceAttr(html, `heading${depth}`, raw)
  }

  paragraph({ tokens, raw }: Tokens.Paragraph): string {
    const text = this.parser.parseInline(tokens)
    const html = `<p>${text}</p>\n`
    return this.#addSourceAttr(html, 'paragraph', raw)
  }

  blockquote({ tokens, raw }: Tokens.Blockquote): string {
    const body = this.parser.parse(tokens)
    const html = `<blockquote>\n${body}</blockquote>\n`
    return this.#addSourceAttr(html, 'blockquote', raw)
  }

  list({ items, ordered, start, raw }: Tokens.List): string {
    const tag = ordered ? 'ol' : 'ul'
    const startAttr = ordered && start !== 1 ? ` start="${start}"` : ''
    const body = items.map(item => this.listitem(item)).join('')
    const html = `<${tag}${startAttr}>\n${body}</${tag}>\n`
    return this.#addSourceAttr(html, 'list', raw)
  }

  listitem({ tokens, task, checked, raw }: Tokens.ListItem): string {
    let itemBody = ''
    if (task) {
      const checkbox = `<input type="checkbox" ${checked ? 'checked' : ''} disabled> `
      itemBody = checkbox + this.parser.parseInline(tokens)
    } else {
      itemBody = this.parser.parse(tokens)
    }
    const html = `<li>${itemBody}</li>\n`
    return this.#addSourceAttr(html, 'listitem', raw)
  }

  code({ text, lang, raw }: Tokens.Code): string {
    const language = hljs.getLanguage(lang || '') ? lang : 'plaintext'
    const highlighted = hljs.highlight(text, { language: language || 'plaintext' }).value
    const html = `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`
    return this.#addSourceAttr(html, 'code', raw)
  }

  table({ header, rows, raw }: Tokens.Table): string {
    const headerCells = header.map(cell =>
      `<th>${this.parser.parseInline(cell.tokens)}</th>`
    ).join('')
    const headerHtml = `<thead><tr>${headerCells}</tr></thead>`

    const bodyRows = rows.map(row => {
      const cells = row.map(cell =>
        `<td>${this.parser.parseInline(cell.tokens)}</td>`
      ).join('')
      return `<tr>${cells}</tr>`
    }).join('\n')
    const bodyHtml = `<tbody>${bodyRows}</tbody>`

    const html = `<table>${headerHtml}${bodyHtml}</table>\n`
    return this.#addSourceAttr(html, 'table', raw)
  }

  // Override inline elements
  strong({ tokens, raw }: Tokens.Strong): string {
    const text = this.parser.parseInline(tokens)
    const html = `<strong>${text}</strong>`
    return this.#addSourceAttr(html, 'strong', raw)
  }

  em({ tokens, raw }: Tokens.Em): string {
    const text = this.parser.parseInline(tokens)
    const html = `<em>${text}</em>`
    return this.#addSourceAttr(html, 'em', raw)
  }

  del({ tokens, raw }: Tokens.Del): string {
    const text = this.parser.parseInline(tokens)
    const html = `<del>${text}</del>`
    return this.#addSourceAttr(html, 'del', raw)
  }

  codespan({ text, raw }: Tokens.Codespan): string {
    const html = `<code>${text}</code>`
    return this.#addSourceAttr(html, 'codespan', raw)
  }

  link({ href, title, tokens, raw }: Tokens.Link): string {
    const text = this.parser.parseInline(tokens)
    const titleAttr = title ? ` title="${title}"` : ''
    const html = `<a href="${href}"${titleAttr}>${text}</a>`
    return this.#addSourceAttr(html, 'link', raw)
  }

  image({ href, title, text, raw }: Tokens.Image): string {
    const titleAttr = title ? ` title="${title}"` : ''
    const html = `<img src="${href}" alt="${text}"${titleAttr}>`
    return this.#addSourceAttr(html, 'image', raw)
  }

  getSourceMap(): SourceMap {
    return this.#sourceMap
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
  // Create custom renderer with source mapping
  const customRenderer = new SourceMappingRenderer(markdown)

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

  // Use the custom renderer
  markedInstance.use({ renderer: customRenderer })

  try {
    let html = await markedInstance.parse(markdown)

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
        'svg', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'text', 'g', 'defs', 'marker'
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'alt', 'src',
        'class', 'id',
        'type', 'checked', 'disabled',
        'data-source-id', // Source mapping attribute
        'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'style', 'marker-end', 'marker-start'
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    })

    return { html: sanitized, sourceMap: customRenderer.getSourceMap() }
  } catch (error) {
    console.error('Markdown rendering error:', error)
    return {
      html: `<div class="render-error">Error rendering markdown: ${(error as Error).message}</div>`,
      sourceMap: new SourceMap()
    }
  }
}
