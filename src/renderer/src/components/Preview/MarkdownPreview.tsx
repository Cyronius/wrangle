import { useEffect, useRef, useState, useCallback } from 'react'
import { renderMarkdownWithSourceMap, initializeMermaid, SourceMap } from '../../utils/markdown-renderer'
import { SourceRange } from '../../utils/source-map'
import './preview.css'

interface MarkdownPreviewProps {
  content: string
  baseDir?: string | null
  syncScroll?: boolean
  onScroll?: (scrollRatio: number) => void
  onSourceSelect?: (range: SourceRange) => void
  zoomLevel?: number
}

export function MarkdownPreview({
  content,
  baseDir = null,
  syncScroll = false,
  onScroll,
  onSourceSelect,
  zoomLevel = 0
}: MarkdownPreviewProps) {
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
      const { html: rendered, sourceMap: map } = await renderMarkdownWithSourceMap(content, baseDir)
      setHtml(rendered)
      setSourceMap(map)
    }
    render()
  }, [content, baseDir])

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

  // Handle scroll synchronization
  useEffect(() => {
    if (!syncScroll || !previewRef.current || !onScroll) return

    const handleScroll = () => {
      if (isScrollingRef.current) return

      const element = previewRef.current
      if (!element) return

      const scrollRatio =
        element.scrollTop / (element.scrollHeight - element.clientHeight) || 0

      onScroll(scrollRatio)
    }

    const element = previewRef.current
    element.addEventListener('scroll', handleScroll)

    return () => {
      element.removeEventListener('scroll', handleScroll)
    }
  }, [syncScroll, onScroll])

  // External scroll (from editor)
  useEffect(() => {
    if (!previewRef.current) return

    const element = previewRef.current

    // This will be called when parent wants to sync preview scroll
    ;(element as any).scrollToRatio = (ratio: number) => {
      isScrollingRef.current = true
      const maxScroll = element.scrollHeight - element.clientHeight
      element.scrollTop = maxScroll * ratio

      setTimeout(() => {
        isScrollingRef.current = false
      }, 100)
    }
  }, [])

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
}

export type { SourceRange }
