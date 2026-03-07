import { useEffect, useRef, useCallback } from 'react'

/**
 * Replaces CSS -webkit-app-region: drag with JavaScript-based window dragging.
 * Chromium has a known bug on Linux where the hit-test map for drag regions
 * becomes stale after maximize/unmaximize, making window controls unclickable.
 * This hook avoids the bug entirely by handling drag via IPC.
 *
 * Elements with the `data-titlebar-drag` attribute become draggable.
 * Interactive children (buttons, tabs, inputs) are excluded automatically.
 *
 * Detects whether e.screenX is valid on mousedown. On Linux/Electron,
 * e.screenX can be 0 for real input events. Falls back to computing screen
 * position from clientX + tracked window position.
 *
 * Root Cause A fix (same as useWindowDrag): after unmaximizeForDrag returns,
 * the WM places the window at its saved normal bounds. We defer the drag anchor
 * to the first subsequent mousemove using reAnchorRef, so the anchor uses the
 * correct post-unmaximize cursor position.
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
    mouseX: number
    mouseY: number
    windowX: number
    windowY: number
  } | null>(null)
  const pendingDragRef = useRef(false)
  const mouseStartRef = useRef<{ clientX: number; clientY: number } | null>(null)

  // Whether e.screenX is valid for this drag session
  const useScreenCoordsRef = useRef(true)
  // Track running window position for clientX fallback
  const currentWindowPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // After unmaximizeForDrag the WM places the window at its saved normal bounds.
  // Defer the anchor to the first subsequent mousemove.
  const reAnchorRef = useRef<{ windowX: number; windowY: number } | null>(null)

  const getMousePos = useCallback((e: MouseEvent) => {
    if (useScreenCoordsRef.current) {
      return { x: e.screenX, y: e.screenY }
    }
    return {
      x: e.clientX + currentWindowPosRef.current.x,
      y: e.clientY + currentWindowPosRef.current.y
    }
  }, [])

  const handleMouseDown = useCallback(async (e: MouseEvent) => {
    if (e.button !== 0) return
    if (!isInDragRegion(e.target)) return

    e.preventDefault()

    const isMax = await window.electron.window.isMaximized()

    if (isMax) {
      // Don't start drag yet - wait for movement threshold
      pendingDragRef.current = true
      mouseStartRef.current = { clientX: e.clientX, clientY: e.clientY }
    } else {
      const pos = await window.electron.window.getPosition()

      // Detect whether screenX is valid
      const expectedScreenX = e.clientX + pos.x
      useScreenCoordsRef.current = e.screenX !== 0 && Math.abs(e.screenX - expectedScreenX) < 100

      const mousePos = useScreenCoordsRef.current
        ? { x: e.screenX, y: e.screenY }
        : { x: e.clientX + pos.x, y: e.clientY + pos.y }

      dragStartRef.current = {
        mouseX: mousePos.x,
        mouseY: mousePos.y,
        windowX: pos.x,
        windowY: pos.y
      }
      currentWindowPosRef.current = { x: pos.x, y: pos.y }
      draggingRef.current = true
    }
  }, [])

  // Async helper: handle unmaximize-for-drag (fire-and-forget from mousemove)
  const startUnmaximizeDrag = useCallback(async (e: MouseEvent) => {
    const cursorX = e.screenX !== 0 ? e.screenX : e.clientX
    const cursorY = e.screenY !== 0 ? e.screenY : e.clientY
    const result = await window.electron.window.unmaximizeForDrag(cursorX, cursorY)
    if (result) {
      reAnchorRef.current = { windowX: result.x, windowY: result.y }
      draggingRef.current = true
      const expectedScreenX = e.clientX + result.x
      useScreenCoordsRef.current = e.screenX !== 0 && Math.abs(e.screenX - expectedScreenX) < 100
    }
  }, [])

  // IMPORTANT: handleMouseMove must be synchronous. An async handler creates
  // microtask boundaries that let window.screenX update between events,
  // causing quadratic position growth.
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (pendingDragRef.current && mouseStartRef.current) {
      const dx = e.clientX - mouseStartRef.current.clientX
      const dy = e.clientY - mouseStartRef.current.clientY
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        pendingDragRef.current = false
        mouseStartRef.current = null
        startUnmaximizeDrag(e)
      }
      return
    }

    // ROOT CAUSE A FIX: complete the drag anchor on first mousemove after unmaximize.
    if (draggingRef.current && reAnchorRef.current) {
      currentWindowPosRef.current = { x: reAnchorRef.current.windowX, y: reAnchorRef.current.windowY }
      const mousePos = getMousePos(e)
      dragStartRef.current = {
        mouseX: mousePos.x,
        mouseY: mousePos.y,
        windowX: reAnchorRef.current.windowX,
        windowY: reAnchorRef.current.windowY,
      }
      reAnchorRef.current = null
      return
    }

    if (!draggingRef.current || !dragStartRef.current) return

    const mousePos = getMousePos(e)
    const deltaX = mousePos.x - dragStartRef.current.mouseX
    const deltaY = mousePos.y - dragStartRef.current.mouseY
    const newX = dragStartRef.current.windowX + deltaX
    const newY = dragStartRef.current.windowY + deltaY
    currentWindowPosRef.current = { x: newX, y: newY }
    window.electron.window.setPosition(newX, newY)
  }, [getMousePos, startUnmaximizeDrag])

  const handleMouseUp = useCallback(() => {
    draggingRef.current = false
    dragStartRef.current = null
    pendingDragRef.current = false
    mouseStartRef.current = null
    reAnchorRef.current = null
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
    reAnchorRef.current = null
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
