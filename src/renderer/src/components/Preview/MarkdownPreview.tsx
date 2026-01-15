import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { renderMarkdownWithSourceMap, initializeMermaid, SourceMap } from '../../utils/markdown-renderer'
import { SourceRange } from '../../utils/source-map'
import './preview.css'

interface MarkdownPreviewProps {
  content: string
  baseDir?: string | null
  syncScroll?: boolean
  onScroll?: (sourceId: string | null) => void  // Source ID of topmost visible element
  onSourceSelect?: (range: SourceRange) => void
  onSourceMapReady?: (sourceMap: SourceMap) => void
  highlightSourceId?: string | null
  zoomLevel?: number
}

export interface MarkdownPreviewHandle {
  scrollToRatio: (ratio: number) => void
  scrollToSourceId: (sourceId: string) => void
}

export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(function MarkdownPreview({
  content,
  baseDir = null,
  syncScroll = false,
  onScroll,
  onSourceSelect,
  onSourceMapReady,
  highlightSourceId,
  zoomLevel = 0
}, ref) {
  // Calculate zoom scale (10% per level)
  const zoomScale = Math.pow(1.1, zoomLevel)
  const [html, setHtml] = useState('')
  const [sourceMap, setSourceMap] = useState<SourceMap | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

  // Initialize Mermaid on mount
  useEffect(() => {
    initializeMermaid()
  }, [])

  // Render markdown whenever content or baseDir changes
  useEffect(() => {
    const render = async () => {
      console.log('[MarkdownPreview] rendering markdown, content length:', content.length)
      const { html: rendered, sourceMap: map } = await renderMarkdownWithSourceMap(content, baseDir)
      console.log('[MarkdownPreview] render complete, sourceMap size:', map.size, 'html length:', rendered.length)
      setHtml(rendered)
      setSourceMap(map)
      onSourceMapReady?.(map)
    }
    render()
  }, [content, baseDir, onSourceMapReady])

  // Handle selection in preview to find source range
  const handleSelectionChange = useCallback(() => {
    if (!onSourceSelect || !sourceMap) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    // Find the element with data-source-id closest to the selection
    const anchorNode = selection.anchorNode
    if (!anchorNode) return

    // Get the element containing the selection
    let element: Element | null = null
    if (anchorNode.nodeType === Node.TEXT_NODE) {
      element = anchorNode.parentElement
    } else if (anchorNode.nodeType === Node.ELEMENT_NODE) {
      element = anchorNode as Element
    }

    if (!element) return

    // Find the closest element with a source-id
    const sourceElement = element.closest('[data-source-id]')
    if (sourceElement) {
      const sourceId = sourceElement.getAttribute('data-source-id')
      if (sourceId) {
        const range = sourceMap.getRange(sourceId)
        if (range) {
          onSourceSelect(range)
        }
      }
    }
  }, [onSourceSelect, sourceMap])

  // Listen for selection changes
  useEffect(() => {
    if (!onSourceSelect) return

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [onSourceSelect, handleSelectionChange])

  // Highlight element based on editor cursor position
  useEffect(() => {
    if (!previewRef.current) return

    // Remove previous highlight
    const previousHighlight = previewRef.current.querySelector('.source-highlight')
    previousHighlight?.classList.remove('source-highlight')

    if (!highlightSourceId) return

    // Find and highlight the element
    const element = previewRef.current.querySelector(`[data-source-id="${highlightSourceId}"]`)
    if (element) {
      element.classList.add('source-highlight')
      // Scroll into view if needed
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [highlightSourceId])

  // Handle scroll synchronization - find topmost visible element with source ID
  useEffect(() => {
    if (!syncScroll || !previewRef.current || !onScroll) return

    const handleScroll = () => {
      if (isScrollingRef.current) return

      const container = previewRef.current
      if (!container) return

      // Find all elements with data-source-id
      const sourceElements = container.querySelectorAll('[data-source-id]')
      const containerRect = container.getBoundingClientRect()

      // Find the first element that's visible in the viewport
      let topmostSourceId: string | null = null
      for (const el of sourceElements) {
        const rect = el.getBoundingClientRect()
        // Check if element is at or below the top of the container
        if (rect.top >= containerRect.top - 50) {
          topmostSourceId = el.getAttribute('data-source-id')
          break
        }
        // If element spans the top of the container, use it
        if (rect.bottom > containerRect.top) {
          topmostSourceId = el.getAttribute('data-source-id')
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
      console.log('[MarkdownPreview] scrollToSourceId called with:', sourceId)
      const container = previewRef.current
      if (!container) {
        console.log('[MarkdownPreview] no container ref')
        return
      }

      const targetElement = container.querySelector(`[data-source-id="${sourceId}"]`) as HTMLElement | null
      console.log('[MarkdownPreview] targetElement found:', !!targetElement)
      if (!targetElement) return

      isScrollingRef.current = true

      // Calculate scroll position relative to container
      const containerRect = container.getBoundingClientRect()
      const elementRect = targetElement.getBoundingClientRect()
      const relativeTop = elementRect.top - containerRect.top + container.scrollTop
      console.log('[MarkdownPreview] scrolling to:', relativeTop)

      container.scrollTop = relativeTop

      setTimeout(() => {
        isScrollingRef.current = false
      }, 100)
    }
  }), [])

  return (
    <div ref={previewRef} className="markdown-preview">
      <div
        className="markdown-body"
        style={{
          fontSize: `${zoomScale}em`,
          lineHeight: 1.6
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
})

export type { SourceRange }
