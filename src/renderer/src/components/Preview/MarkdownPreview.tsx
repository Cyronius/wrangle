import { Component, useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo, memo } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import { remarkSourcePositions } from '../../utils/remark-source-positions'
import { rehypeSourcePositions } from '../../utils/rehype-source-positions'
import { extractFrontMatter, renderFrontMatter } from '../../utils/markdown-renderer'
import { SourceMap, buildSourceMapFromDOM } from '../../utils/source-map'
import { usePreviewCursor } from '../../hooks/usePreviewCursor'
import {
  ParagraphRenderer,
  H1Renderer, H2Renderer, H3Renderer, H4Renderer, H5Renderer, H6Renderer,
  StrongRenderer, EmRenderer, DelRenderer,
  UlRenderer, OlRenderer, LiRenderer,
  BlockquoteRenderer, PreRenderer, CodeRenderer,
  createImageRenderer
} from './renderers'
import './preview.css'

// Re-export SourceMap for consumers
export { SourceMap }

/**
 * Error boundary specifically for the markdown preview.
 * If ReactMarkdown or a rehype/remark plugin crashes on certain content,
 * this catches the error and shows a fallback instead of killing the entire app.
 */
class PreviewErrorBoundary extends Component<
  { children: ReactNode; content: string },
  { error: Error | null; errorContent: string | null }
> {
  constructor(props: { children: ReactNode; content: string }) {
    super(props)
    this.state = { error: null, errorContent: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Preview render error:', error, errorInfo)
    this.setState({ errorContent: this.props.content })
  }

  componentDidUpdate(prevProps: { content: string }) {
    // If content changes from the content that caused the error, try again
    if (this.state.error && this.props.content !== this.state.errorContent) {
      this.setState({ error: null, errorContent: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '24px',
          color: 'var(--text-muted, #888)',
          fontSize: '13px',
          lineHeight: '1.6'
        }}>
          <p style={{ color: 'var(--error-color, #f44336)', fontWeight: 500 }}>
            Preview could not render this content.
          </p>
          <pre style={{
            fontSize: '11px',
            padding: '8px 12px',
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '4px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '80px'
          }}>
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

interface MarkdownPreviewProps {
  content: string
  baseDir?: string | null
  syncScroll?: boolean
  onScroll?: (sourceId: string | null) => void  // Source ID of topmost visible element
  onSourceMapReady?: (sourceMap: SourceMap) => void
  onSelectionChange?: (selection: { start: number; end: number } | null) => void  // Selection in source offsets
  zoomLevel?: number
}

export interface MarkdownPreviewHandle {
  scrollToRatio: (ratio: number) => void
  scrollToSourceId: (sourceId: string) => void
}

export const MarkdownPreview = memo(forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(function MarkdownPreview({
  content,
  baseDir = null,
  syncScroll = false,
  onScroll,
  onSourceMapReady,
  onSelectionChange,
  zoomLevel = 0
}, ref) {
  // Calculate zoom scale (10% per level)
  const zoomScale = Math.pow(1.1, zoomLevel)
  const previewRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)
  const [sourceMap, setSourceMap] = useState<SourceMap | null>(null)

  // Track selection in preview for WYSIWYG editing
  usePreviewCursor(contentRef, {
    onSelectionChange,
    enabled: true
  })

  // Extract front matter before passing to ReactMarkdown
  const { content: markdownContent, data: frontMatterData, hasFrontMatter } = useMemo(
    () => extractFrontMatter(content),
    [content]
  )

  // Create image component with current baseDir
  const ImageRenderer = useMemo(() => createImageRenderer(baseDir), [baseDir])

  // Memoize components object to avoid recreating on every render
  const components = useMemo(() => ({
    p: ParagraphRenderer,
    h1: H1Renderer,
    h2: H2Renderer,
    h3: H3Renderer,
    h4: H4Renderer,
    h5: H5Renderer,
    h6: H6Renderer,
    strong: StrongRenderer,
    em: EmRenderer,
    del: DelRenderer,
    ul: UlRenderer,
    ol: OlRenderer,
    li: LiRenderer,
    blockquote: BlockquoteRenderer,
    pre: PreRenderer,
    code: CodeRenderer,
    img: ImageRenderer
  }), [ImageRenderer])

  // Memoize plugin arrays
  const remarkPlugins = useMemo(() => [
    remarkGfm,
    remarkMath,
    remarkSourcePositions
  ], [])

  const rehypePlugins = useMemo(() => [
    rehypeRaw,
    rehypeKatex,
    rehypeHighlight,
    rehypeSourcePositions
  ], [])

  // Build source map from DOM after ReactMarkdown renders
  useEffect(() => {
    // Delay to ensure ReactMarkdown has rendered and to avoid rebuilding too frequently
    const timer = setTimeout(() => {
      if (contentRef.current) {
        const map = buildSourceMapFromDOM(contentRef.current)
        setSourceMap(map)
        onSourceMapReady?.(map)
      }
    }, 800) // Increased to 800ms to reduce rebuild frequency during typing

    return () => clearTimeout(timer)
  }, [markdownContent, onSourceMapReady])

  // Rich text copy handler - copies selected HTML for pasting into email clients etc.
  const handleCopy = useCallback(async (e: ClipboardEvent) => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    // Check if selection is within the preview
    const previewEl = previewRef.current
    if (!previewEl?.contains(selection.anchorNode)) return

    e.preventDefault()

    const range = selection.getRangeAt(0)
    const fragment = range.cloneContents()

    // Serialize to HTML
    const div = document.createElement('div')
    div.appendChild(fragment)
    const html = div.innerHTML
    const plainText = selection.toString()

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' })
        })
      ])
    } catch (error) {
      console.error('Failed to copy rich text:', error)
    }
  }, [])

  // Register copy event handler
  useEffect(() => {
    document.addEventListener('copy', handleCopy)
    return () => document.removeEventListener('copy', handleCopy)
  }, [handleCopy])

  // Handle scroll synchronization - find topmost visible element with source position
  useEffect(() => {
    if (!syncScroll || !previewRef.current || !onScroll) return

    const handleScroll = () => {
      if (isScrollingRef.current) return

      const container = previewRef.current
      if (!container) return

      // Find all elements with data-source-start
      const sourceElements = container.querySelectorAll('[data-source-start]')
      const containerRect = container.getBoundingClientRect()

      // Find the first element that's visible in the viewport
      let topmostSourceId: string | null = null
      for (const el of sourceElements) {
        const rect = el.getBoundingClientRect()
        // Check if element is at or below the top of the container
        if (rect.top >= containerRect.top - 50) {
          // Use the start offset as the "source ID"
          topmostSourceId = el.getAttribute('data-source-start')
          break
        }
        // If element spans the top of the container, use it
        if (rect.bottom > containerRect.top) {
          topmostSourceId = el.getAttribute('data-source-start')
          break
        }
      }

      onScroll(topmostSourceId)
    }

    const element = previewRef.current
    element.addEventListener('scroll', handleScroll)

    return () => {
      element.removeEventListener('scroll', handleScroll)
    }
  }, [syncScroll, onScroll])

  // Expose scroll methods via ref
  useImperativeHandle(ref, () => ({
    scrollToRatio: (ratio: number) => {
      const element = previewRef.current
      if (!element) return

      isScrollingRef.current = true
      const maxScroll = element.scrollHeight - element.clientHeight
      element.scrollTop = maxScroll * ratio

      setTimeout(() => {
        isScrollingRef.current = false
      }, 100)
    },
    scrollToSourceId: (sourceId: string) => {
      const container = previewRef.current
      if (!container) return

      // sourceId is now the start offset - find element by data-source-start
      const targetElement = container.querySelector(`[data-source-start="${sourceId}"]`) as HTMLElement | null
      if (!targetElement) return

      isScrollingRef.current = true

      // Calculate scroll position relative to container
      const containerRect = container.getBoundingClientRect()
      const elementRect = targetElement.getBoundingClientRect()
      const relativeTop = elementRect.top - containerRect.top + container.scrollTop

      container.scrollTop = relativeTop

      setTimeout(() => {
        isScrollingRef.current = false
      }, 100)
    }
  }), [])

  return (
    <div ref={previewRef} className="markdown-preview">
      <div
        ref={contentRef}
        className="markdown-body"
        contentEditable
        suppressContentEditableWarning
        onBeforeInput={(e) => e.preventDefault()}
        onInput={(e) => e.preventDefault()}
        onPaste={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          // Block Backspace and Delete explicitly
          if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault()
            return
          }
          // Allow navigation keys
          const allowedKeys = [
            'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
            'Home', 'End', 'PageUp', 'PageDown',
            'Shift', 'Control', 'Alt', 'Meta',
            'Tab', 'Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
          ]
          // Block all other keys except navigation and modifiers
          if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            return
          }
        }}
        onKeyPress={(e) => e.preventDefault()}
        style={{
          fontSize: `${zoomScale}em`,
          lineHeight: 1.6,
          outline: 'none',
          caretColor: 'var(--preview-cursor-color, #4daafc)',
          cursor: 'text'
        }}
      >
        {/* Front matter rendered separately */}
        {hasFrontMatter && (
          <div dangerouslySetInnerHTML={{ __html: renderFrontMatter(frontMatterData) }} />
        )}
        {/* ReactMarkdown renders the markdown - wrapped in error boundary
            so a rehype/remark plugin crash doesn't kill the entire app */}
        <PreviewErrorBoundary content={markdownContent}>
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={components}
          >
            {markdownContent}
          </ReactMarkdown>
        </PreviewErrorBoundary>
      </div>
    </div>
  )
}))

