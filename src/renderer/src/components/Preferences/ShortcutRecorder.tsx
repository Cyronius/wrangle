import { useState, useEffect, useCallback, useRef } from 'react'
import { formatKeyboardEvent, isValidShortcut, normalizeShortcut } from '../../utils/shortcut-parser'

interface ShortcutRecorderProps {
  value: string | null
  onChange: (shortcut: string | null) => void
  onCancel: () => void
  hasConflict?: boolean
  disabled?: boolean
}

export function ShortcutRecorder({
  value,
  onChange,
  onCancel,
  hasConflict = false,
  disabled = false
}: ShortcutRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [pendingShortcut, setPendingShortcut] = useState<string | null>(null)
  const ref = useRef<HTMLButtonElement>(null)

  // Start recording when clicking
  const handleClick = useCallback(() => {
    if (disabled) return
    setIsRecording(true)
    setPendingShortcut(null)
  }, [disabled])

  // Handle keydown during recording
  useEffect(() => {
    if (!isRecording) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Escape cancels recording
      if (e.key === 'Escape') {
        setIsRecording(false)
        setPendingShortcut(null)
        onCancel()
        return
      }

      // Don't record modifier-only presses
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

      // Validate the shortcut
      if (!isValidShortcut(normalized)) {
        // Show a brief flash or hint that it's invalid
        setPendingShortcut(normalized)
        return
      }

      // Accept the shortcut
      setPendingShortcut(null)
      setIsRecording(false)
      onChange(normalized)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isRecording, onChange, onCancel])

  // Handle click outside to cancel
  useEffect(() => {
    if (!isRecording) return

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsRecording(false)
        setPendingShortcut(null)
        onCancel()
      }
    }

    // Use timeout to prevent immediate trigger
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isRecording, onCancel])

  // Focus the button when recording starts
  useEffect(() => {
    if (isRecording && ref.current) {
      ref.current.focus()
    }
  }, [isRecording])

  const displayValue = isRecording
    ? pendingShortcut || 'Press keys...'
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
