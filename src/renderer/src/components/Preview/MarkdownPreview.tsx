import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import { remarkSourcePositions } from '../../utils/remark-source-positions'
import { rehypeSourcePositions } from '../../utils/rehype-source-positions'
import { extractFrontMatter, renderFrontMatter } from '../../utils/markdown-renderer'
import { SourceMap, SourceRange, buildSourceMapFromDOM } from '../../utils/source-map'
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
 * Find the innermost element with position data that contains the click point.
 * This is more accurate than walking up, as it finds the most specific element.
 */
function findInnermostPositionedElement(
  container: Element,
  x: number,
  y: number
): Element | null {
  // Get all elements with position data
  const elements = container.querySelectorAll('[data-source-start]')
  let bestMatch: Element | null = null
  let smallestArea = Infinity

  for (const el of elements) {
    const rect = el.getBoundingClientRect()
    // Check if click is within this element's bounds
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      const area = rect.width * rect.height
      // Prefer smaller (more specific) elements
      if (area < smallestArea) {
        smallestArea = area
        bestMatch = el
      }
    }
  }

  return bestMatch
}

/**
 * Calculate the source offset for a click within a positioned element.
 *
 * Uses data-text-start and data-text-end attributes to know where the actual
 * text content begins and ends within the source range. This handles markdown
 * syntax correctly (e.g., **bold** has syntax before and after the text).
 */
function calculateSourceOffset(
  element: Element,
  clickX: number,
  clickY: number
): number {
  // Use caretRangeFromPoint to find exact click position in text
  const range = document.caretRangeFromPoint(clickX, clickY)
  if (!range) {
    const start = element.getAttribute('data-source-start')
    return start ? parseInt(start, 10) : 0
  }

  const clickContainer = range.startContainer
  const clickOffset = range.startOffset

  // If the click is in a text node, find the best positioned element
  if (clickContainer.nodeType === Node.TEXT_NODE) {
    // Walk up to find the closest element with position data
    let targetElement: Element | null = clickContainer.parentElement
    while (targetElement && !targetElement.hasAttribute('data-source-start')) {
      targetElement = targetElement.parentElement
    }

    if (!targetElement) {
      targetElement = element
    }

    // Get the text range - where actual text content is in the source
    const textStart = targetElement.getAttribute('data-text-start')
    const textEnd = targetElement.getAttribute('data-text-end')
    const sourceStart = targetElement.getAttribute('data-source-start')
    const sourceEnd = targetElement.getAttribute('data-source-end')

    if (textStart !== null && textEnd !== null) {
      // We have precise text position data
      const textStartOffset = parseInt(textStart, 10)
      const textEndOffset = parseInt(textEnd, 10)

      // Calculate character offset within this element's text content
      const charOffset = getTextBeforeNode(targetElement, clickContainer, clickOffset)

      // Map to source position: textStart + charOffset
      const sourcePos = textStartOffset + charOffset
      return Math.min(sourcePos, textEndOffset)
    }

    // Fallback: use source positions (less accurate for formatted elements)
    if (sourceStart !== null && sourceEnd !== null) {
      const start = parseInt(sourceStart, 10)
      const end = parseInt(sourceEnd, 10)
      const charOffset = getTextBeforeNode(targetElement, clickContainer, clickOffset)
      return Math.min(start + charOffset, end - 1)
    }
  }

  // Ultimate fallback: element start
  const start = element.getAttribute('data-source-start')
  return start ? parseInt(start, 10) : 0
}

/**
 * Get the number of text characters before a specific position in a node.
 */
function getTextBeforeNode(
  container: Element,
  targetNode: Node,
  targetOffset: number
): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  let count = 0

  while (walker.nextNode()) {
    const textNode = walker.currentNode
    if (textNode === targetNode) {
      return count + targetOffset
    }
    count += (textNode.textContent || '').length
  }

  return count
}

interface MarkdownPreviewProps {
  content: string
  baseDir?: string | null
  syncScroll?: boolean
  onScroll?: (sourceId: string | null) => void  // Source ID of topmost visible element
  onSourceSelect?: (range: SourceRange) => void  // Called when text is selected (drag)
  onSourceClick?: (offset: number) => void  // Called when clicking (position cursor at offset)
  onSourceMapReady?: (sourceMap: SourceMap) => void
  highlightSourceId?: string | null
  zoomLevel?: number
  // Cursor props (for scroll sync parent tracking)
  cursorOffset?: number | null
  selectionRange?: { start: number; end: number } | null
  showPseudoCursor?: boolean  // Legacy prop - now we use native contentEditable cursor
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
  onSourceClick,
  onSourceMapReady,
  highlightSourceId,
  zoomLevel = 0,
  cursorOffset: _cursorOffset = null,
  selectionRange: _selectionRange = null,
  showPseudoCursor: _showPseudoCursor = false
}, ref) {
  // Calculate zoom scale (10% per level)
  const zoomScale = Math.pow(1.1, zoomLevel)
  const previewRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)
  const [sourceMap, setSourceMap] = useState<SourceMap | null>(null)

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
    // Small delay to ensure ReactMarkdown has rendered
    const timer = setTimeout(() => {
      if (contentRef.current) {
        const map = buildSourceMapFromDOM(contentRef.current)
        setSourceMap(map)
        onSourceMapReady?.(map)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [markdownContent, onSourceMapReady])

  // Handle click in preview - position cursor at clicked character position
  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    if (!onSourceClick || !contentRef.current) return

    // Check if the click is inside a contentEditable element (for native cursor support)
    const target = e.target as HTMLElement
    const editableElement = target.isContentEditable ? target : target.closest('[contenteditable]')

    if (editableElement) {
      // Let native cursor handle it, but still report source offset for editor sync
      const element = findInnermostPositionedElement(contentRef.current, e.clientX, e.clientY)
      if (element) {
        const sourceOffset = calculateSourceOffset(element, e.clientX, e.clientY)
        onSourceClick(sourceOffset)
      }
      return
    }

    // Prevent default behavior for non-editable elements
    e.preventDefault()

    // Find the innermost element with position data at the click point
    const element = findInnermostPositionedElement(contentRef.current, e.clientX, e.clientY)
    if (!element) return

    // Calculate the exact source offset for this click
    const sourceOffset = calculateSourceOffset(element, e.clientX, e.clientY)
    onSourceClick(sourceOffset)
  }, [onSourceClick])

  // Handle selection in preview to find source range
  const handleSelectionChange = useCallback(() => {
    if (!onSourceSelect) return

    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

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

    // Find the closest element with source position data
    const sourceElement = element.closest('[data-source-start]')
    if (sourceElement) {
      const startAttr = sourceElement.getAttribute('data-source-start')
      const endAttr = sourceElement.getAttribute('data-source-end')
      if (startAttr !== null && endAttr !== null) {
        onSourceSelect({
          start: parseInt(startAttr, 10),
          end: parseInt(endAttr, 10)
        })
      }
    }
  }, [onSourceSelect])

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
    if (!contentRef.current) return

    // Remove previous highlight
    const previousHighlight = contentRef.current.querySelector('.source-highlight')
    previousHighlight?.classList.remove('source-highlight')

    if (!highlightSourceId || !sourceMap) return

    // Find element by source ID (which is now based on start offset)
    // Look for element where offset falls within its range
    const entry = sourceMap.getEntry(highlightSourceId)
    if (entry) {
      const element = contentRef.current.querySelector(
        `[data-source-start="${entry.sourceRange.start}"]`
      )
      if (element) {
        element.classList.add('source-highlight')
        element.scrollIntoView({ behavior: 'instant', block: 'nearest' })
      }
    }
  }, [highlightSourceId, sourceMap])

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
        style={{
          fontSize: `${zoomScale}em`,
          lineHeight: 1.6
        }}
        onClick={handlePreviewClick}
      >
        {/* Front matter rendered separately */}
        {hasFrontMatter && (
          <div dangerouslySetInnerHTML={{ __html: renderFrontMatter(frontMatterData) }} />
        )}
        {/* ReactMarkdown renders the markdown */}
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={components}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  )
})

export type { SourceRange }
