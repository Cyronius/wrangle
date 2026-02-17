import { useEffect, useRef, useCallback } from 'react'

/**
 * Replaces CSS -webkit-app-region: drag with JavaScript-based window dragging.
 * Chromium has a known bug on Linux where the hit-test map for drag regions
 * becomes stale after maximize/unmaximize, making window controls unclickable.
 * This hook avoids the bug entirely by handling drag via IPC.
 *
 * Elements with the `data-titlebar-drag` attribute become draggable.
 * Interactive children (buttons, tabs, inputs) are excluded automatically.
 */

const INTERACTIVE_SELECTORS = [
  'button', 'input', 'a', 'select', 'textarea',
  '.tab', '.sortable-tab-wrapper', '.tab-group-scrollable',
  '.tab-group-scroll-btn', '.tab-bar-overflow',
  '.tab-context-menu', '.window-controls', '.window-control-btn',
  '.sidebar', '.sidebar-menu-btn'
].join(',')

function isInDragRegion(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  // Must be inside a [data-titlebar-drag] element
  if (!target.closest('[data-titlebar-drag]')) return false
  // Must NOT be an interactive element or inside one
  if (target.closest(INTERACTIVE_SELECTORS)) return false
  return true
}

export function useTitlebarDrag(): void {
  const draggingRef = useRef(false)
  const dragStartRef = useRef<{
    mouseScreenX: number
    mouseScreenY: number
    windowX: number
    windowY: number
  } | null>(null)
  const pendingDragRef = useRef(false)
  const mouseStartRef = useRef<{ screenX: number; screenY: number } | null>(null)

  const handleMouseDown = useCallback(async (e: MouseEvent) => {
    if (e.button !== 0) return
    if (!isInDragRegion(e.target)) return

    e.preventDefault()

    const isMax = await window.electron.window.isMaximized()

    if (isMax) {
      // Don't start drag yet - wait for movement threshold
      pendingDragRef.current = true
      mouseStartRef.current = { screenX: e.screenX, screenY: e.screenY }
    } else {
      const pos = await window.electron.window.getPosition()
      dragStartRef.current = {
        mouseScreenX: e.screenX,
        mouseScreenY: e.screenY,
        windowX: pos.x,
        windowY: pos.y
      }
      draggingRef.current = true
    }
  }, [])

  const handleMouseMove = useCallback(async (e: MouseEvent) => {
    if (pendingDragRef.current && mouseStartRef.current) {
      const dx = e.screenX - mouseStartRef.current.screenX
      const dy = e.screenY - mouseStartRef.current.screenY
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        // Threshold exceeded while maximized - unmaximize and start drag
        pendingDragRef.current = false
        mouseStartRef.current = null
        const result = await window.electron.window.unmaximizeForDrag(e.screenX, e.screenY)
        if (result) {
          dragStartRef.current = {
            mouseScreenX: e.screenX,
            mouseScreenY: e.screenY,
            windowX: result.x,
            windowY: result.y
          }
          draggingRef.current = true
        }
      }
      return
    }

    if (!draggingRef.current || !dragStartRef.current) return

    const deltaX = e.screenX - dragStartRef.current.mouseScreenX
    const deltaY = e.screenY - dragStartRef.current.mouseScreenY
    window.electron.window.setPosition(
      dragStartRef.current.windowX + deltaX,
      dragStartRef.current.windowY + deltaY
    )
  }, [])

  const handleMouseUp = useCallback(() => {
    draggingRef.current = false
    dragStartRef.current = null
    pendingDragRef.current = false
    mouseStartRef.current = null
  }, [])

  const handleDblClick = useCallback((e: MouseEvent) => {
    if (!isInDragRegion(e.target)) return
    window.electron.window.maximize()
  }, [])

  const handleBlur = useCallback(() => {
    draggingRef.current = false
    dragStartRef.current = null
    pendingDragRef.current = false
    mouseStartRef.current = null
  }, [])

  useEffect(() => {
    window.addEventListener('mousedown', handleMouseDown, { capture: true })
    window.addEventListener('mousemove', handleMouseMove, { capture: true })
    window.addEventListener('mouseup', handleMouseUp, { capture: true })
    window.addEventListener('dblclick', handleDblClick, { capture: true })
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, { capture: true })
      window.removeEventListener('mousemove', handleMouseMove, { capture: true })
      window.removeEventListener('mouseup', handleMouseUp, { capture: true })
      window.removeEventListener('dblclick', handleDblClick, { capture: true })
      window.removeEventListener('blur', handleBlur)
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleDblClick, handleBlur])
}
