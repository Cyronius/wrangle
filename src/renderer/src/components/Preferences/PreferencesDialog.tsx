import { useState, useEffect, useCallback, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../../store/store'
import { loadSettings } from '../../store/settingsSlice'
import { KeyboardShortcutsTab } from './KeyboardShortcutsTab'
import { ThemeEditorTab } from './ThemeEditorTab'
import './PreferencesDialog.css'

interface PreferencesDialogProps {
  isOpen: boolean
  onClose: () => void
}

type TabId = 'shortcuts' | 'themes'

export function PreferencesDialog({ isOpen, onClose }: PreferencesDialogProps) {
  const dispatch = useDispatch<AppDispatch>()
  const { loaded, loading } = useSelector((state: RootState) => state.settings)
  const [activeTab, setActiveTab] = useState<TabId>('shortcuts')
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const dialogRef = useRef<HTMLDivElement>(null)

  // Load settings on first open
  useEffect(() => {
    if (isOpen && !loaded && !loading) {
      dispatch(loadSettings())
    }
  }, [isOpen, loaded, loading, dispatch])

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Reset position when modal closes
  useEffect(() => {
    if (!isOpen) {
      setPosition(null)
      setIsDragging(false)
    }
  }, [isOpen])

  // Handle drag start on header
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!dialogRef.current) return

    const rect = dialogRef.current.getBoundingClientRect()
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
    setIsDragging(true)

    // If this is the first drag, initialize position from current centered position
    if (!position) {
      setPosition({ x: rect.left, y: rect.top })
    }
  }, [position])

  // Handle drag move and end
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x
      const newY = e.clientY - dragOffset.current.y

      // Clamp to viewport bounds
      const dialogWidth = dialogRef.current?.offsetWidth || 800
      const dialogHeight = dialogRef.current?.offsetHeight || 600
      const maxX = window.innerWidth - dialogWidth
      const maxY = window.innerHeight - dialogHeight

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Handle overlay click to close
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  if (!isOpen) return null

  // Compute dialog style based on whether it's been dragged
  const dialogStyle: React.CSSProperties = position
    ? { left: position.x, top: position.y, transform: 'none' }
    : {}

  return (
    <div className={`preferences-overlay ${position ? 'dragged' : ''}`} onClick={handleOverlayClick}>
      <div
        ref={dialogRef}
        className={`preferences-dialog ${isDragging ? 'dragging' : ''}`}
        style={dialogStyle}
      >
        <div
          className="preferences-header"
          onMouseDown={handleDragStart}
        >
          <h2>Preferences</h2>
          <button className="preferences-close" onClick={onClose} title="Close">
            <svg viewBox="0 0 10 10" width="12" height="12">
              <path
                d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4-4-4z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        <div className="preferences-tabs">
          <button
            className={`preferences-tab ${activeTab === 'shortcuts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            Keyboard Shortcuts
          </button>
          <button
            className={`preferences-tab ${activeTab === 'themes' ? 'active' : ''}`}
            onClick={() => setActiveTab('themes')}
          >
            Theme Editor
          </button>
        </div>

        <div className="preferences-content">
          {loading ? (
            <div className="preferences-loading">Loading settings...</div>
          ) : activeTab === 'shortcuts' ? (
            <KeyboardShortcutsTab />
          ) : (
            <ThemeEditorTab />
          )}
        </div>
      </div>
    </div>
  )
}
