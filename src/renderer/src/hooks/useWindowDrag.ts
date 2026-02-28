import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Enables Alt+mouse drag to move the window from anywhere.
 * Uses IPC-based window positioning instead of -webkit-app-region: drag,
 * which is unreliable on Linux/Electron with complex DOM (Monaco, Allotment).
 * Returns whether the drag overlay should be shown.
 */
export function useWindowDrag(): boolean {
  const [altHeld, setAltHeld] = useState(false)
  const draggingRef = useRef(false)
  const pendingDragRef = useRef(false)
  const mouseStartRef = useRef<{ screenX: number; screenY: number } | null>(null)
  const dragStartRef = useRef<{
    mouseScreenX: number
    mouseScreenY: number
    windowX: number
    windowY: number
  } | null>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Alt') {
      setAltHeld(true)
    }
  }, [])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Alt') {
      setAltHeld(false)
      draggingRef.current = false
      dragStartRef.current = null
      pendingDragRef.current = false
      mouseStartRef.current = null
    }
  }, [])

  const handleMouseDown = useCallback(async (e: MouseEvent) => {
    if (!altHeld) return
    if (e.button !== 0) return

    e.preventDefault()
    e.stopPropagation()

    const isMax = await window.electron.window.isMaximized()

    if (isMax) {
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
  }, [altHeld])

  const handleMouseMove = useCallback(async (e: MouseEvent) => {
    if (pendingDragRef.current && mouseStartRef.current) {
      const dx = e.screenX - mouseStartRef.current.screenX
      const dy = e.screenY - mouseStartRef.current.screenY
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
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

    e.preventDefault()
    e.stopPropagation()

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

  const handleBlur = useCallback(() => {
    setAltHeld(false)
    draggingRef.current = false
    dragStartRef.current = null
    pendingDragRef.current = false
    mouseStartRef.current = null
  }, [])

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
