import { useState, useEffect, useCallback } from 'react'

/**
 * Enables Alt+mouse drag to move the window from anywhere.
 * Returns whether the drag overlay should be shown.
 */
export function useWindowDrag(): boolean {
  const [showOverlay, setShowOverlay] = useState(false)
  const [altHeld, setAltHeld] = useState(false)
  const [mouseDown, setMouseDown] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Alt') {
      setAltHeld(true)
    }
  }, [])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Alt') {
      setAltHeld(false)
    }
  }, [])

  const handleMouseDown = useCallback(() => {
    setMouseDown(true)
  }, [])

  const handleMouseUp = useCallback(() => {
    setMouseDown(false)
  }, [])

  const handleBlur = useCallback(() => {
    setAltHeld(false)
    setMouseDown(false)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    window.addEventListener('keyup', handleKeyUp, { capture: true })
    window.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
      window.removeEventListener('keyup', handleKeyUp, { capture: true })
      window.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [handleKeyDown, handleKeyUp, handleMouseDown, handleMouseUp, handleBlur])

  useEffect(() => {
    setShowOverlay(altHeld)
  }, [altHeld, mouseDown])

  return showOverlay
}
