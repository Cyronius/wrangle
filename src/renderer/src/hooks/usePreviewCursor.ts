import { useEffect, useCallback, RefObject } from 'react'

interface UsePreviewCursorOptions {
  onCursorMove?: (offset: number) => void
  onSelectionChange?: (range: { start: number; end: number } | null) => void
  enabled?: boolean
}

/**
 * Get the source offset for a position within a contentEditable element.
 * Uses data-text-start/end attributes for accurate mapping.
 */
function getSourceOffsetFromSelection(
  node: Node,
  offset: number,
  container: HTMLElement
): number | null {
  // Find the closest element with source position data
  let element: Element | null = null
  if (node.nodeType === Node.TEXT_NODE) {
    element = node.parentElement
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    element = node as Element
  }

  if (!element) return null

  // Walk up to find element with data-source-start
  let sourceElement: Element | null = element
  while (sourceElement && !sourceElement.hasAttribute('data-source-start')) {
    sourceElement = sourceElement.parentElement
    if (sourceElement === container || !sourceElement) break
  }

  if (!sourceElement || !sourceElement.hasAttribute('data-source-start')) {
    return null
  }

  const textStart = sourceElement.getAttribute('data-text-start')
  const textEnd = sourceElement.getAttribute('data-text-end')
  const sourceStart = sourceElement.getAttribute('data-source-start')
  const sourceEnd = sourceElement.getAttribute('data-source-end')

  // Calculate character offset within this element
  const charOffset = getTextOffsetInElement(sourceElement, node, offset)

  if (textStart !== null && textEnd !== null) {
    const textStartNum = parseInt(textStart, 10)
    const textEndNum = parseInt(textEnd, 10)
    return Math.min(textStartNum + charOffset, textEndNum)
  }

  if (sourceStart !== null && sourceEnd !== null) {
    const startNum = parseInt(sourceStart, 10)
    const endNum = parseInt(sourceEnd, 10)
    return Math.min(startNum + charOffset, endNum - 1)
  }

  return null
}

/**
 * Count text characters from the start of an element to a specific node/offset.
 */
function getTextOffsetInElement(
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
 * Hook to track cursor position and selection in the preview pane.
 * Reports source offsets back to the editor for synchronization.
 */
export function usePreviewCursor(
  containerRef: RefObject<HTMLElement>,
  options: UsePreviewCursorOptions = {}
) {
  const { onCursorMove, onSelectionChange, enabled = true } = options

  const handleSelectionChange = useCallback(() => {
    if (!enabled || !containerRef.current) return

    const selection = window.getSelection()
    if (!selection) return

    // Check if selection is within our container
    if (!selection.anchorNode || !containerRef.current.contains(selection.anchorNode)) {
      return
    }

    if (selection.isCollapsed) {
      // Cursor position only (no selection)
      const offset = getSourceOffsetFromSelection(
        selection.anchorNode,
        selection.anchorOffset,
        containerRef.current
      )
      if (offset !== null && onCursorMove) {
        onCursorMove(offset)
      }
      if (onSelectionChange) {
        onSelectionChange(null)
      }
    } else {
      // Text selection
      const startOffset = getSourceOffsetFromSelection(
        selection.anchorNode,
        selection.anchorOffset,
        containerRef.current
      )
      const endOffset = selection.focusNode ? getSourceOffsetFromSelection(
        selection.focusNode,
        selection.focusOffset,
        containerRef.current
      ) : null

      if (startOffset !== null && endOffset !== null && onSelectionChange) {
        // Normalize so start < end
        const start = Math.min(startOffset, endOffset)
        const end = Math.max(startOffset, endOffset)
        onSelectionChange({ start, end })
      }
    }
  }, [containerRef, onCursorMove, onSelectionChange, enabled])

  useEffect(() => {
    if (!enabled) return

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [handleSelectionChange, enabled])

  return {
    handleSelectionChange
  }
}
