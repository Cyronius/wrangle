import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from 'react'
import { Streamdown, defaultRehypePlugins, defaultRemarkPlugins } from 'streamdown'
import { remarkSourcePositions } from '../../utils/remark-source-positions'
import { rehypeSourcePositions } from '../../utils/rehype-source-positions'
import { extractFrontMatter, renderFrontMatter } from '../../utils/markdown-renderer'
import { SourceMap, SourceRange, buildSourceMapFromDOM } from '../../utils/source-map'
import './preview.css'

// No-op plugin to replace sanitize and harden (they strip our data-source-* attributes)
const noopPlugin = () => (tree: unknown) => tree

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

/**
 * Custom image component for Streamdown that transforms relative paths.
 * This replicates the image path transformation that was done post-rendering with marked.
 */
function createImageComponent(baseDir: string | null) {
  return function ImageComponent(props: React.ImgHTMLAttributes<HTMLImageElement>) {
    const { src, alt, ...rest } = props
    const [imageSrc, setImageSrc] = useState<string | undefined>(src)

    useEffect(() => {
      async function loadImage() {
        if (!src || !baseDir || !src.startsWith('./')) {
          setImageSrc(src)
          return
        }

        try {
          // Remove leading ./
          const relativePath = src.substring(2)
          // Combine with base directory (use platform-specific path separator)
          const absolutePath = `${baseDir}\\${relativePath.replace(/\//g, '\\')}`

          // Read image as data URL through IPC
          const dataURL = await window.electron.file.readImageAsDataURL(absolutePath)
          if (dataURL) {
            setImageSrc(dataURL)
          }
        } catch (error) {
          console.error('[ImageComponent] Error loading image:', error)
        }
      }

      loadImage()
    }, [src])

    return <img src={imageSrc} alt={alt || ''} {...rest} />
  }
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
  // Pseudo-cursor and selection props
  cursorOffset?: number | null  // Editor cursor offset for pseudo-cursor display
  selectionRange?: { start: number; end: number } | null  // Editor selection range
  showPseudoCursor?: boolean  // Whether to show pseudo-cursor (linked mode in split view)
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
  cursorOffset = null,
  selectionRange: _selectionRange = null,  // TODO: implement pseudo-selection with Streamdown
  showPseudoCursor = false
}, ref) {
  // Calculate zoom scale (10% per level)
  const zoomScale = Math.pow(1.1, zoomLevel)
  const previewRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)
  const [sourceMap, setSourceMap] = useState<SourceMap | null>(null)

  // Extract front matter before passing to Streamdown
  const { content: markdownContent, data: frontMatterData, hasFrontMatter } = useMemo(
    () => extractFrontMatter(content),
    [content]
  )

  // Create image component with current baseDir
  const ImageComponent = useMemo(() => createImageComponent(baseDir), [baseDir])

  // Memoize plugin arrays to avoid breaking Streamdown's caching
  const remarkPluginsArray = useMemo(() => [
    // Default remark plugins (gfm, math, etc.)
    ...Object.values(defaultRemarkPlugins),
    // Our plugin to add source position data via hProperties
    remarkSourcePositions
  ], [])

  const rehypePluginsArray = useMemo(() => [
    // Keep default plugins but override sanitize/harden with no-ops
    // (they strip our data-source-* attributes needed for cursor positioning)
    defaultRehypePlugins.raw,
    noopPlugin, // was: sanitize
    defaultRehypePlugins.katex,
    noopPlugin, // was: harden
    // Add our rehype source positions plugin as fallback
    rehypeSourcePositions
  ], [])

  // Build source map from DOM after Streamdown renders
  useEffect(() => {
    // Small delay to ensure Streamdown has rendered
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

    // Prevent default behavior (e.g., anchor navigation, text selection)
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

  // Render pseudo-cursor in preview based on editor cursor position
  const [cursorPosition, setCursorPosition] = useState<{ top: number; left: number; height: number } | null>(null)

  // Store cursor target info for recalculation on scroll
  const cursorTargetRef = useRef<{
    startOffset: number
    localOffset: number
    element: Element | null
  } | null>(null)

  // Function to calculate cursor position from stored target info
  const calculateCursorPosition = useCallback(() => {
    const target = cursorTargetRef.current
    if (!target || !previewRef.current || !target.element) {
      setCursorPosition(null)
      return
    }

    const { localOffset, element } = target
    const containerRect = previewRef.current.getBoundingClientRect()
    const tagName = element.tagName.toLowerCase()

    // For block-level only elements (tables, code blocks, etc.), show block cursor at element start
    if (tagName === 'table' || tagName === 'pre') {
      const rect = element.getBoundingClientRect()
      setCursorPosition({
        top: rect.top - containerRect.top + previewRef.current.scrollTop,
        left: rect.left - containerRect.left - 8,
        height: rect.height
      })
      return
    }

    // For text elements, find the exact character position using Range API
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)
    let charCount = 0
    let targetNode: Text | null = null
    let targetOffset = 0

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text
      const content = textNode.textContent || ''

      // Skip whitespace-only nodes
      if (content.trim() === '') continue

      const nodeLength = content.length

      if (charCount + nodeLength >= localOffset) {
        targetNode = textNode
        targetOffset = Math.min(localOffset - charCount, nodeLength)
        break
      }
      charCount += nodeLength
    }

    if (targetNode) {
      // Use Range API to get exact cursor position without modifying DOM
      const range = document.createRange()
      range.setStart(targetNode, targetOffset)
      range.setEnd(targetNode, targetOffset)
      const rect = range.getBoundingClientRect()

      if (rect.width === 0 && rect.height === 0) {
        // Range returned no dimensions, fall back to element position
        const elemRect = element.getBoundingClientRect()
        setCursorPosition({
          top: elemRect.top - containerRect.top + previewRef.current.scrollTop,
          left: elemRect.left - containerRect.left,
          height: parseFloat(getComputedStyle(element).lineHeight) || 20
        })
      } else {
        setCursorPosition({
          top: rect.top - containerRect.top + previewRef.current.scrollTop,
          left: rect.left - containerRect.left,
          height: rect.height || parseFloat(getComputedStyle(element).lineHeight) || 20
        })
      }
    } else {
      // Fallback: position at element start
      const rect = element.getBoundingClientRect()
      setCursorPosition({
        top: rect.top - containerRect.top + previewRef.current.scrollTop,
        left: rect.left - containerRect.left,
        height: parseFloat(getComputedStyle(element).lineHeight) || 20
      })
    }
  }, [])

  // Update cursor target when cursor offset changes
  useEffect(() => {
    if (!showPseudoCursor || cursorOffset === null || !contentRef.current) {
      cursorTargetRef.current = null
      setCursorPosition(null)
      return
    }

    // Find the element containing this cursor offset
    const elements = contentRef.current.querySelectorAll('[data-source-start]')
    let targetElement: Element | null = null
    let localOffset = 0

    for (const el of elements) {
      const startAttr = el.getAttribute('data-source-start')
      const endAttr = el.getAttribute('data-source-end')
      if (startAttr === null || endAttr === null) continue

      const start = parseInt(startAttr, 10)
      const end = parseInt(endAttr, 10)

      if (cursorOffset >= start && cursorOffset < end) {
        targetElement = el
        localOffset = cursorOffset - start
        break
      }
    }

    if (!targetElement) {
      cursorTargetRef.current = null
      setCursorPosition(null)
      return
    }

    // Store target for recalculation
    cursorTargetRef.current = {
      startOffset: parseInt(targetElement.getAttribute('data-source-start') || '0', 10),
      localOffset,
      element: targetElement
    }

    // Calculate initial position
    calculateCursorPosition()
  }, [showPseudoCursor, cursorOffset, calculateCursorPosition, markdownContent])

  // Recalculate cursor position on scroll
  useEffect(() => {
    if (!previewRef.current || !showPseudoCursor) return

    const container = previewRef.current
    container.addEventListener('scroll', calculateCursorPosition)
    return () => container.removeEventListener('scroll', calculateCursorPosition)
  }, [showPseudoCursor, calculateCursorPosition])

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

      // sourceId is now the start offset - find element by data-source-start
      const targetElement = container.querySelector(`[data-source-start="${sourceId}"]`) as HTMLElement | null
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
        {/* Streamdown renders the markdown */}
        <Streamdown
          remarkPlugins={remarkPluginsArray}
          rehypePlugins={rehypePluginsArray}
          parseIncompleteMarkdown={false}
          components={{
            img: ImageComponent
          }}
        >
          {markdownContent}
        </Streamdown>
      </div>
      {/* Pseudo-cursor overlay - absolutely positioned to avoid React DOM conflicts */}
      {showPseudoCursor && cursorPosition && (
        <div
          className="pseudo-cursor-overlay"
          style={{
            position: 'absolute',
            top: cursorPosition.top,
            left: cursorPosition.left,
            width: 2,
            height: cursorPosition.height,
            backgroundColor: 'var(--pseudo-cursor-color, #4daafc)',
            pointerEvents: 'none',
            animation: 'pseudo-cursor-blink 1s step-end infinite'
          }}
        />
      )}
    </div>
  )
})

export type { SourceRange }
