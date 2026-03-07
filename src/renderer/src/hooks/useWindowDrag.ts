import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Enables Alt+mouse drag to move the window from anywhere.
 * Uses IPC-based window positioning instead of -webkit-app-region: drag,
 * which is unreliable on Linux/Electron with complex DOM (Monaco, Allotment).
 *
 * When dragging from a maximized window, unmaximizes during the drag and
 * re-maximizes on release (WD-002).
 *
 * Key robustness features:
 * - Detects whether e.screenX is valid on mousedown. On Linux/Electron,
 *   e.screenX can be 0 for real input events. When invalid, falls back to
 *   computing screen position as clientX + tracked window position.
 * - Uses refs (not state) for event guards to avoid stale-closure race conditions
 * - Blur and keyup don't kill an active drag (WM transitions cause transient events)
 * - mouseButtonDownRef guards the handleMouseDown async continuation: if mouseup
 *   fires before the IPC awaits complete, the continuation aborts rather than
 *   installing a ghost dragging state (Root Cause B fix)
 * - reAnchorRef fixes the coordinate system mismatch that occurs after
 *   unmaximize: the WM restores the window to its saved normal bounds.
 *   On the first mousemove after the unmaximize settles, we re-anchor using
 *   the current cursor position and the WM-confirmed window position.
 *   (Root Cause A fix)
 * - forceMaximize (not the toggle maximize) is used on mouseup to safely
 *   re-maximize without risking an accidental unmaximize if a WM race has
 *   already maximized the window. (Root Cause C fix)
 *
 * Returns whether the drag overlay should be shown.
 */
export function useWindowDrag(): boolean {
  // State drives the overlay render; ref drives the synchronous event guard
  const [altHeld, setAltHeld] = useState(false)
  const altHeldRef = useRef(false)

  const draggingRef = useRef(false)
  const pendingDragRef = useRef(false)
  const wasMaximizedRef = useRef(false)
  // True while awaiting unmaximizeForDrag IPC — covers the gap where
  // pendingDragRef is false but draggingRef isn't true yet
  const unmaximizingRef = useRef(false)
  // Track if the mouse button is physically held (set on mousedown, cleared on mouseup)
  const mouseButtonDownRef = useRef(false)
  const mouseStartRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const dragStartRef = useRef<{
    mouseX: number
    mouseY: number
    windowX: number
    windowY: number
  } | null>(null)

  // Whether e.screenX is valid for this drag session.
  // Detected on mousedown by checking if screenX ≈ clientX + windowPosition.
  // On Linux/Electron, screenX can be 0 for real input events (sendInputEvent,
  // native input). When false, we reconstruct screen position from
  // clientX + tracked window position.
  const useScreenCoordsRef = useRef(true)

  // Track running window position for the clientX fallback path.
  // Updated on each setPosition call. Used to reconstruct screen position:
  //   estimatedScreenX = clientX + currentWindowPos.x
  const currentWindowPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // After unmaximizeForDrag the WM places the window at its saved normal bounds
  // (not where we requested). We defer the drag anchor to the first subsequent
  // mousemove so we capture the cursor position in the new coordinate system.
  const reAnchorRef = useRef<{ windowX: number; windowY: number } | null>(null)

  /** Whether any phase of a drag operation is in progress */
  const isDragActive = useCallback(() => {
    return draggingRef.current || pendingDragRef.current || unmaximizingRef.current
  }, [])

  /** Get the effective screen X/Y from a mouse event */
  const getMousePos = useCallback((e: MouseEvent) => {
    if (useScreenCoordsRef.current) {
      return { x: e.screenX, y: e.screenY }
    }
    // Fallback: reconstruct from clientX + tracked window position
    return {
      x: e.clientX + currentWindowPosRef.current.x,
      y: e.clientY + currentWindowPosRef.current.y
    }
  }, [])

  // Debug: expose refs for test inspection via window.__dragDebug
  ;(window as any).__dragDebug = {
    get dragging() { return draggingRef.current },
    get pending() { return pendingDragRef.current },
    get dragStart() { return dragStartRef.current },
    get reAnchor() { return reAnchorRef.current },
    get mouseButton() { return mouseButtonDownRef.current },
    get wasMax() { return wasMaximizedRef.current },
    get unmaximizing() { return unmaximizingRef.current },
    get altHeld() { return altHeldRef.current },
    get useScreenCoords() { return useScreenCoordsRef.current },
    isDragActive: () => draggingRef.current || pendingDragRef.current || unmaximizingRef.current,
    moveCalls: 0,
    setPosCalls: 0,
    lastScreenX: 0,
    lastDelta: 0,
  }

  const resetDragState = useCallback(() => {
    draggingRef.current = false
    dragStartRef.current = null
    pendingDragRef.current = false
    mouseStartRef.current = null
    wasMaximizedRef.current = false
    unmaximizingRef.current = false
    mouseButtonDownRef.current = false
    reAnchorRef.current = null
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Alt') {
      altHeldRef.current = true
      setAltHeld(true)
    }
  }, [])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Alt') {
      altHeldRef.current = false
      setAltHeld(false)
      // Don't kill an active drag — the drag continues until mouseup.
      // Window state transitions can cause the WM to replay Alt keyup.
      if (!isDragActive()) {
        resetDragState()
      }
    }
  }, [isDragActive, resetDragState])

  const handleMouseDown = useCallback(async (e: MouseEvent) => {
    if (!altHeldRef.current) return
    if (e.button !== 0) return

    e.preventDefault()
    e.stopPropagation()

    mouseButtonDownRef.current = true

    const isMax = await window.electron.window.isMaximized()

    // ROOT CAUSE B FIX: if mouseup fired during the IPC round-trip, abort.
    if (!mouseButtonDownRef.current) return

    if (isMax) {
      pendingDragRef.current = true
      wasMaximizedRef.current = true
      mouseStartRef.current = { clientX: e.clientX, clientY: e.clientY }
    } else {
      const pos = await window.electron.window.getPosition()

      // Guard again: mouseup may have fired during the second IPC await
      if (!mouseButtonDownRef.current) return

      // Detect whether screenX is valid by checking if it approximately
      // equals clientX + windowPosition. If screenX is 0 (Linux/Electron
      // real input), fall back to clientX + tracked window position.
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
      wasMaximizedRef.current = false
    }
  }, [])

  // Async helper: handle unmaximize-for-drag (fire-and-forget from mousemove)
  const startUnmaximizeDrag = useCallback(async (e: MouseEvent) => {
    unmaximizingRef.current = true
    const cursorX = e.screenX !== 0 ? e.screenX : e.clientX
    const cursorY = e.screenY !== 0 ? e.screenY : e.clientY
    const result = await window.electron.window.unmaximizeForDrag(cursorX, cursorY)
    unmaximizingRef.current = false
    if (result) {
      reAnchorRef.current = { windowX: result.x, windowY: result.y }
      draggingRef.current = true
      const expectedScreenX = e.clientX + result.x
      useScreenCoordsRef.current = e.screenX !== 0 && Math.abs(e.screenX - expectedScreenX) < 100
    }
  }, [])

  // Async helper: self-healing re-anchor (fire-and-forget from mousemove)
  const selfHealDrag = useCallback(async (e: MouseEvent) => {
    const pos = await window.electron.window.getPosition()
    currentWindowPosRef.current = { x: pos.x, y: pos.y }
    const mousePos = getMousePos(e)
    dragStartRef.current = {
      mouseX: mousePos.x,
      mouseY: mousePos.y,
      windowX: pos.x,
      windowY: pos.y
    }
    draggingRef.current = true
  }, [getMousePos])

  // IMPORTANT: handleMouseMove must be synchronous. An async mousemove handler
  // creates microtask boundaries that change event processing timing, allowing
  // window.screenX to update between events and causing quadratic position growth.
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const _d = (window as any).__dragDebug; if (_d) _d.moveCalls++
    // Pending drag from maximized state — check threshold
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

    // ROOT CAUSE A FIX: complete the drag anchor on the first mousemove after
    // unmaximize. At this point draggingRef=true but dragStartRef=null.
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

    if (!draggingRef.current || !dragStartRef.current) {
      // Self-healing: re-anchor if drag state got disrupted by blur/WM events
      if (mouseButtonDownRef.current && wasMaximizedRef.current && (e.buttons & 1) && !unmaximizingRef.current) {
        selfHealDrag(e)
      }
      return
    }

    e.preventDefault()
    e.stopPropagation()

    const mousePos = getMousePos(e)
    const deltaX = mousePos.x - dragStartRef.current.mouseX
    const deltaY = mousePos.y - dragStartRef.current.mouseY

    const newX = dragStartRef.current.windowX + deltaX
    const newY = dragStartRef.current.windowY + deltaY

    const d = (window as any).__dragDebug
    if (d) { d.setPosCalls++; d.lastScreenX = mousePos.x; d.lastDelta = deltaX }

    // Update tracked window position for the clientX fallback path
    currentWindowPosRef.current = { x: newX, y: newY }

    window.electron.window.setPosition(newX, newY)
  }, [getMousePos, startUnmaximizeDrag, selfHealDrag])

  const handleMouseUp = useCallback(() => {
    const shouldReMaximize = wasMaximizedRef.current && draggingRef.current

    draggingRef.current = false
    dragStartRef.current = null
    pendingDragRef.current = false
    mouseStartRef.current = null
    wasMaximizedRef.current = false
    unmaximizingRef.current = false
    mouseButtonDownRef.current = false
    reAnchorRef.current = null

    if (shouldReMaximize) {
      // Brief delay to let the final setPosition IPC settle before maximizing.
      // ROOT CAUSE C FIX: use forceMaximize (always maximizes) instead of
      // the toggle maximize() which would unmaximize if the window happens to
      // already be maximized (WM race or parallel maximize call).
      setTimeout(() => {
        window.electron.window.forceMaximize()
      }, 50)
    }
  }, [])

  const handleBlur = useCallback(() => {
    altHeldRef.current = false
    setAltHeld(false)
    // Don't kill an active drag on blur — window repositioning during
    // unmaximize can cause transient blur events from the window manager.
    // The drag will clean up naturally on mouseup.
    if (!isDragActive() && !mouseButtonDownRef.current) {
      resetDragState()
    }
  }, [isDragActive, resetDragState])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp, { capture: true })
    window.addEventListener('mousedown', handleMouseDown, { capture: true })
    window.addEventListener('mousemove', handleMouseMove, { capture: true })
    window.addEventListener('mouseup', handleMouseUp, { capture: true })
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp, { capture: true })
      window.removeEventListener('mousedown', handleMouseDown, { capture: true })
      window.removeEventListener('mousemove', handleMouseMove, { capture: true })
      window.removeEventListener('mouseup', handleMouseUp, { capture: true })
      window.removeEventListener('blur', handleBlur)
    }
  }, [handleKeyDown, handleKeyUp, handleMouseDown, handleMouseMove, handleMouseUp, handleBlur])

  return altHeld
}
