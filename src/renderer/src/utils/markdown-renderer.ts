import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

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
