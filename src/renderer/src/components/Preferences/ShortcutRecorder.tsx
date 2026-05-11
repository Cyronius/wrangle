import { useState, useEffect, useCallback, useRef } from 'react'
import { formatKeyboardEvent, isValidShortcut, normalizeShortcut } from '../../utils/shortcut-parser'

export type ShortcutRecorderMode = 'chord' | 'modifier-only' | 'tap'

interface ShortcutRecorderProps {
  value: string | null
  onChange: (shortcut: string | null) => void
  onCancel: () => void
  hasConflict?: boolean
  disabled?: boolean
  /**
   * `chord` (default): captures Ctrl+Shift+B style chord.
   * `modifier-only`: captures a single bare modifier (Ctrl, Alt, etc.) used
   *   for `bindingShape.suffix` commands like `view.zoomScroll`.
   * `tap`: same capture rules as `modifier-only` (the suffix is "Tap").
   */
  mode?: ShortcutRecorderMode
}

export function ShortcutRecorder({
  value,
  onChange,
  onCancel,
  hasConflict = false,
  disabled = false,
  mode = 'chord'
}: ShortcutRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [pendingShortcut, setPendingShortcut] = useState<string | null>(null)
  const ref = useRef<HTMLButtonElement>(null)

  const allowModifierOnly = mode === 'modifier-only' || mode === 'tap'

  const handleClick = useCallback(() => {
    if (disabled) return
    setIsRecording(true)
    setPendingShortcut(null)
  }, [disabled])

  useEffect(() => {
    if (!isRecording) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setIsRecording(false)
        setPendingShortcut(null)
        onCancel()
        return
      }

      if (allowModifierOnly) {
        // In modifier-only mode we accept the modifier key on its own,
        // captured via keyup so we know the user isn't chording.
        return
      }

      // Don't record modifier-only presses in chord mode
      if (
        e.key === 'Control' ||
        e.key === 'Shift' ||
        e.key === 'Alt' ||
        e.key === 'Meta'
      ) {
        return
      }

      const shortcut = formatKeyboardEvent(e)
      const normalized = normalizeShortcut(shortcut)

      if (!isValidShortcut(normalized)) {
        setPendingShortcut(normalized)
        return
      }

      setPendingShortcut(null)
      setIsRecording(false)
      onChange(normalized)
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!allowModifierOnly) return
      if (
        e.key !== 'Control' &&
        e.key !== 'Shift' &&
        e.key !== 'Alt' &&
        e.key !== 'Meta'
      ) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const shortcut = formatKeyboardEvent(e, true)
      const normalized = normalizeShortcut(shortcut)
      if (!isValidShortcut(normalized, true)) {
        setPendingShortcut(normalized)
        return
      }
      setPendingShortcut(null)
      setIsRecording(false)
      onChange(normalized)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [isRecording, onChange, onCancel, allowModifierOnly])

  useEffect(() => {
    if (!isRecording) return

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsRecording(false)
        setPendingShortcut(null)
        onCancel()
      }
    }

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isRecording, onCancel])

  useEffect(() => {
    if (isRecording && ref.current) {
      ref.current.focus()
    }
  }, [isRecording])

  const placeholder = allowModifierOnly ? 'Press a modifier...' : 'Press keys...'
  const displayValue = isRecording
    ? pendingShortcut || placeholder
    : value || 'Unbound'

  const className = [
    'shortcut-key',
    isRecording && 'recording',
    !value && !isRecording && 'unbound',
    hasConflict && 'conflict'
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      ref={ref}
      className={className}
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? 'Cannot edit built-in presets' : 'Click to change shortcut'}
    >
      {displayValue}
    </button>
  )
}
