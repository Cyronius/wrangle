import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { MarkdownToolbar } from './MarkdownToolbar'
import { getValidEditor } from '../../utils/get-valid-editor'
import * as monaco from 'monaco-editor'
import './floating-toolbar.css'

interface FloatingToolbarProps {
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>
  previewSelection: { start: number; end: number } | null
  containerRef: React.RefObject<HTMLDivElement | null>
  activeTabId?: string
  viewMode: string
  isMarkdown?: boolean
}

type ToolbarState = 'hidden' | 'dot' | 'toolbar'
type Placement = 'above' | 'below'

interface Position {
  top: number
  left: number
  placement: Placement
}

function getMonacoSelectionRect(
  editor: monaco.editor.IStandaloneCodeEditor
): DOMRect | null {
  const selection = editor.getSelection()
  if (!selection || selection.isEmpty()) return null

  const containerDom = editor.getContainerDomNode()
  if (!containerDom) return null
  const containerRect = containerDom.getBoundingClientRect()

  const startPos = selection.getStartPosition()
  const endPos = selection.getEndPosition()

  const startCoords = editor.getScrolledVisiblePosition(startPos)
  const endCoords = editor.getScrolledVisiblePosition(endPos)
  if (!startCoords || !endCoords) return null

  const top = containerRect.top + startCoords.top
  const bottom = containerRect.top + endCoords.top + endCoords.height
  const left = containerRect.left + Math.min(startCoords.left, endCoords.left)
  const right = containerRect.left + Math.max(startCoords.left, endCoords.left)

  if (startPos.lineNumber !== endPos.lineNumber) {
    const layoutInfo = editor.getLayoutInfo()
    return new DOMRect(
      containerRect.left + layoutInfo.contentLeft,
      top,
      layoutInfo.contentWidth,
      bottom - top
    )
  }

  return new DOMRect(left, top, Math.max(right - left, 1), bottom - top)
}

function getMonacoCursorRect(
  editor: monaco.editor.IStandaloneCodeEditor
): DOMRect | null {
  const position = editor.getPosition()
  if (!position) return null

  const containerDom = editor.getContainerDomNode()
  if (!containerDom) return null
  const containerRect = containerDom.getBoundingClientRect()

  const coords = editor.getScrolledVisiblePosition(position)
  if (!coords) return null

  return new DOMRect(
    containerRect.left + coords.left,
    containerRect.top + coords.top,
    1,
    coords.height
  )
}

function getPreviewSelectionRect(): DOMRect | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

  const previewEl = document.querySelector('.markdown-preview')
  if (!previewEl || !selection.anchorNode || !previewEl.contains(selection.anchorNode)) return null

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  return rect
}

function computeToolbarPosition(
  anchorRect: DOMRect,
  toolbarWidth: number,
  toolbarHeight: number,
  containerRect: DOMRect,
  gap: number = 8
): Position {
  let left = anchorRect.left + (anchorRect.width / 2) - (toolbarWidth / 2)
  left = Math.max(containerRect.left + 4, left)
  left = Math.min(containerRect.right - toolbarWidth - 4, left)

  let top = anchorRect.top - toolbarHeight - gap
  let placement: Placement = 'above'

  if (top < containerRect.top) {
    top = anchorRect.bottom + gap
    placement = 'below'
  }

  return { top, left, placement }
}

/** Check if an event target is inside the Monaco editor */
function isInEditor(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  return !!target.closest('.monaco-editor')
}

/** Check if an event target is inside the preview pane */
function isInPreview(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  return !!target.closest('.markdown-preview')
}

export function FloatingToolbar({
  editorRef,
  previewSelection,
  containerRef,
  activeTabId,
  viewMode,
  isMarkdown = true
}: FloatingToolbarProps) {
  // Suppress toolbar entirely for non-markdown files
  if (!isMarkdown) return null
  const [state, setState] = useState<ToolbarState>('hidden')
  const [position, setPosition] = useState<Position>({ top: 0, left: 0, placement: 'above' })
  const [dotPosition, setDotPosition] = useState<{ top: number; left: number } | null>(null)
  const [selectionSource, setSelectionSource] = useState<'editor' | 'preview' | null>(null)

  const toolbarRef = useRef<HTMLDivElement>(null)
  const dotExpandedRef = useRef(false)
  const mouseDownInToolbarRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable refs for mutable state used in event handlers
  const stateRef = useRef(state)
  stateRef.current = state
  const selectionSourceRef = useRef(selectionSource)
  selectionSourceRef.current = selectionSource
  const editorRefRef = useRef(editorRef)
  editorRefRef.current = editorRef
  const containerRefRef = useRef(containerRef)
  containerRefRef.current = containerRef
  const viewModeRef = useRef(viewMode)
  viewModeRef.current = viewMode

  const doUpdateToolbarPosition = useCallback((anchorRect: DOMRect) => {
    const container = containerRefRef.current.current
    if (!container) return

    const toolbarEl = toolbarRef.current
    const toolbarWidth = toolbarEl?.offsetWidth || 500
    const toolbarHeight = toolbarEl?.offsetHeight || 36

    const containerRect = container.getBoundingClientRect()
    const pos = computeToolbarPosition(anchorRect, toolbarWidth, toolbarHeight, containerRect)
    setPosition(pos)
  }, [])

  const showDot = useCallback(() => {
    const editor = getValidEditor(editorRefRef.current)
    if (!editor || viewModeRef.current === 'preview-only') return

    const cursorRect = getMonacoCursorRect(editor)
    if (cursorRect) {
      setDotPosition({
        top: cursorRect.top + (cursorRect.height / 2) - 12,
        left: cursorRect.left + 16
      })
      setState('dot')
    }
  }, [])

  const showToolbarForEditor = useCallback(() => {
    const editor = getValidEditor(editorRefRef.current)
    if (!editor) return

    const rect = getMonacoSelectionRect(editor)
    if (rect) {
      setSelectionSource('editor')
      setState('toolbar')
      doUpdateToolbarPosition(rect)
    }
  }, [doUpdateToolbarPosition])

  const showToolbarForPreview = useCallback(() => {
    const rect = getPreviewSelectionRect()
    if (rect) {
      setSelectionSource('preview')
      setState('toolbar')
      doUpdateToolbarPosition(rect)
    }
  }, [doUpdateToolbarPosition])

  const hide = useCallback(() => {
    setState('hidden')
    setDotPosition(null)
    setSelectionSource(null)
    dotExpandedRef.current = false
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  // Reset on tab or view mode change
  useEffect(() => {
    hide()
  }, [activeTabId, viewMode, hide])

  // Main interaction: mouseup on document → check for selection
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Ignore mouseup on the floating toolbar itself
      if (mouseDownInToolbarRef.current) {
        mouseDownInToolbarRef.current = false
        return
      }

      if (debounceRef.current) clearTimeout(debounceRef.current)

      debounceRef.current = setTimeout(() => {
        const editor = getValidEditor(editorRefRef.current)
        const inEd = isInEditor(e.target)
        const inPv = isInPreview(e.target)

        // Check Monaco selection first
        if (editor && inEd) {
          const selection = editor.getSelection()
          if (selection && !selection.isEmpty()) {
            dotExpandedRef.current = false
            showToolbarForEditor()
            return
          }
          // No selection in editor — show dot
          if (dotExpandedRef.current) {
            dotExpandedRef.current = false
            hide()
            return
          }
          showDot()
          return
        }

        // Check preview selection
        if (inPv) {
          const sel = window.getSelection()
          if (sel && !sel.isCollapsed) {
            showToolbarForPreview()
            return
          }
        }

        // Clicked elsewhere — hide unless clicked on toolbar
        if (stateRef.current !== 'hidden') {
          const toolbarEl = toolbarRef.current
          if (toolbarEl && toolbarEl.contains(e.target as Node)) return
          hide()
        }
      }, 10)
    }

    // Selection change: detect when selection is cleared (e.g. via keyboard)
    const handleSelectionChange = () => {
      if (stateRef.current !== 'toolbar') return

      if (selectionSourceRef.current === 'editor') {
        const editor = getValidEditor(editorRefRef.current)
        if (editor) {
          const selection = editor.getSelection()
          if (selection && selection.isEmpty()) {
            hide()
          }
        }
      } else if (selectionSourceRef.current === 'preview') {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed) {
          hide()
        }
      }
    }

    // Keyboard: detect text selection via shift+arrows, and escape to dismiss
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (stateRef.current !== 'hidden') {
          hide()
        }
        return
      }

      // After shift+arrow keys, check if there's now a selection in the editor
      if (e.shiftKey || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
        const editor = getValidEditor(editorRefRef.current)
        if (editor) {
          const selection = editor.getSelection()
          if (selection && !selection.isEmpty()) {
            showToolbarForEditor()
          } else if (stateRef.current === 'toolbar' && selectionSourceRef.current === 'editor') {
            hide()
          }
        }
      }
    }

    // Typing: hide dot when user types
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current === 'dot' && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        setState('hidden')
        setDotPosition(null)
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('keyup', handleKeyUp)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('keydown', handleKeyDown)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [showToolbarForEditor, showToolbarForPreview, showDot, hide])

  // Preview selection prop changes (from usePreviewCursor hook)
  useEffect(() => {
    if (previewSelection) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        showToolbarForPreview()
      }, 150)
    } else if (selectionSource === 'preview' && state === 'toolbar') {
      hide()
    }
  }, [previewSelection, selectionSource, state, showToolbarForPreview, hide])

  // Scroll repositioning
  useEffect(() => {
    if (state === 'hidden') return

    const handleScroll = () => {
      if (stateRef.current === 'toolbar') {
        if (selectionSourceRef.current === 'editor') {
          const editor = getValidEditor(editorRefRef.current)
          if (editor) {
            const rect = getMonacoSelectionRect(editor)
            if (rect) {
              doUpdateToolbarPosition(rect)
            } else {
              hide()
            }
          }
        } else if (selectionSourceRef.current === 'preview') {
          const rect = getPreviewSelectionRect()
          if (rect) {
            doUpdateToolbarPosition(rect)
          } else {
            hide()
          }
        }
      } else if (stateRef.current === 'dot') {
        const editor = getValidEditor(editorRefRef.current)
        if (editor) {
          const cursorRect = getMonacoCursorRect(editor)
          if (cursorRect) {
            setDotPosition({
              top: cursorRect.top + (cursorRect.height / 2) - 12,
              left: cursorRect.left + 16
            })
          } else {
            setState('hidden')
            setDotPosition(null)
          }
        }
      }
    }

    // Listen to scroll events on the content area (captures both editor and preview scrolls)
    const container = containerRefRef.current.current
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true, capture: true })
      return () => container.removeEventListener('scroll', handleScroll, { capture: true } as EventListenerOptions)
    }
  }, [state, doUpdateToolbarPosition, hide])

  // Recompute toolbar position after it renders (for accurate dimensions)
  useLayoutEffect(() => {
    if (state === 'toolbar' && toolbarRef.current) {
      const editor = getValidEditor(editorRef)
      let rect: DOMRect | null = null

      if (selectionSource === 'editor' && editor) {
        rect = getMonacoSelectionRect(editor)
      } else if (selectionSource === 'preview') {
        rect = getPreviewSelectionRect()
      }

      if (rect) {
        doUpdateToolbarPosition(rect)
      }
    }
  }, [state, selectionSource, editorRef, doUpdateToolbarPosition])

  const handleDotClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    mouseDownInToolbarRef.current = true
    dotExpandedRef.current = true

    const editor = getValidEditor(editorRef)
    if (!editor) return

    const cursorRect = getMonacoCursorRect(editor)
    if (cursorRect) {
      setSelectionSource('editor')
      setState('toolbar')
      doUpdateToolbarPosition(cursorRect)
    }
  }, [editorRef, doUpdateToolbarPosition])

  const handleToolbarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    mouseDownInToolbarRef.current = true
  }, [])

  // Dot rendering
  if (state === 'dot' && dotPosition) {
    return (
      <div
        className="floating-trigger-dot"
        style={{
          top: dotPosition.top,
          left: dotPosition.left
        }}
        onMouseDown={handleDotClick}
      >
        <span className="floating-trigger-dot-icon">+</span>
      </div>
    )
  }

  // Full toolbar rendering
  if (state === 'toolbar') {
    return (
      <div
        ref={toolbarRef}
        className={`floating-toolbar-container placement-${position.placement}`}
        style={{
          top: position.top,
          left: position.left
        }}
        onMouseDown={handleToolbarMouseDown}
      >
        <MarkdownToolbar
          editorRef={editorRef as React.RefObject<monaco.editor.IStandaloneCodeEditor>}
          previewSelection={previewSelection}
          className="floating"
          getEditor={() => getValidEditor(editorRef)}
        />
      </div>
    )
  }

  return null
}
