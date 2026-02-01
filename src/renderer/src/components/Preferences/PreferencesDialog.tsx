import { useState, useEffect, useCallback, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../../store/store'
import { loadSettings, setPreferencesDialogBounds, saveLayoutSettings } from '../../store/settingsSlice'
import { KeyboardShortcutsTab } from './KeyboardShortcutsTab'
import { ThemeEditorTab } from './ThemeEditorTab'
import './PreferencesDialog.css'

interface PreferencesDialogProps {
  isOpen: boolean
  onClose: () => void
}

type TabId = 'shortcuts' | 'themes'

const MIN_WIDTH = 400
const MIN_HEIGHT = 300
const DEFAULT_WIDTH = 800
const DEFAULT_HEIGHT = 600

export function PreferencesDialog({ isOpen, onClose }: PreferencesDialogProps) {
  const dispatch = useDispatch<AppDispatch>()
  const { loaded, loading } = useSelector((state: RootState) => state.settings)
  const savedBounds = useSelector((state: RootState) => state.settings.layout.preferencesDialog)
  const [activeTab, setActiveTab] = useState<TabId>('themes')

  // Position and size state
  const [bounds, setBounds] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  // Drag state
  const dragRef = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Resize state
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number; startLeft: number; startTop: number; edge: string } | null>(null)
  const [isResizing, setIsResizing] = useState(false)

  // Ref to track latest bounds for persistence
  const boundsRef = useRef(bounds)
  useEffect(() => { boundsRef.current = bounds }, [bounds])

  // Keep a ref to the current layout state for persistence
  const layoutState = useSelector((state: RootState) => state.settings.layout)
  const layoutRef = useRef(layoutState)
  useEffect(() => { layoutRef.current = layoutState }, [layoutState])

  // Initialize bounds from saved state or center
  useEffect(() => {
    if (isOpen && !bounds) {
      if (savedBounds) {
        const clamped = clampBounds(savedBounds.x, savedBounds.y, savedBounds.width, savedBounds.height)
        setBounds(clamped)
      } else {
        const w = Math.min(DEFAULT_WIDTH, window.innerWidth - 40)
        const h = Math.min(DEFAULT_HEIGHT, window.innerHeight - 40)
        setBounds({
          x: (window.innerWidth - w) / 2,
          y: (window.innerHeight - h) / 2,
          width: w,
          height: h
        })
      }
    }
  }, [isOpen, savedBounds, bounds])

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

  // Drag handlers
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !bounds) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      const newX = dragRef.current.startLeft + dx
      const newY = dragRef.current.startTop + dy
      const clamped = clampBounds(newX, newY, bounds.width, bounds.height)
      setBounds(prev => prev ? { ...prev, x: clamped.x, y: clamped.y } : prev)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragRef.current = null
      persistBounds()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, bounds])

  // Resize handlers
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current || !bounds) return
      const dx = e.clientX - resizeRef.current.startX
      const dy = e.clientY - resizeRef.current.startY
      const edge = resizeRef.current.edge

      let newWidth = bounds.width
      let newHeight = bounds.height
      let newX = bounds.x
      let newY = bounds.y

      if (edge.includes('right')) {
        newWidth = Math.max(MIN_WIDTH, resizeRef.current.startWidth + dx)
      }
      if (edge.includes('bottom')) {
        newHeight = Math.max(MIN_HEIGHT, resizeRef.current.startHeight + dy)
      }
      if (edge.includes('left')) {
        const widthDelta = resizeRef.current.startWidth - dx
        if (widthDelta >= MIN_WIDTH) {
          newWidth = widthDelta
          newX = resizeRef.current.startLeft + dx
        }
      }
      if (edge.includes('top')) {
        const heightDelta = resizeRef.current.startHeight - dy
        if (heightDelta >= MIN_HEIGHT) {
          newHeight = heightDelta
          newY = resizeRef.current.startTop + dy
        }
      }

      const clamped = clampBounds(newX, newY, newWidth, newHeight)
      setBounds(clamped)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      resizeRef.current = null
      persistBounds()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, bounds])

  const persistBounds = useCallback(() => {
    // Read from ref to get latest bounds after state update settles
    setTimeout(() => {
      const b = boundsRef.current
      if (b) {
        dispatch(setPreferencesDialogBounds(b))
        dispatch(saveLayoutSettings({ ...layoutRef.current, preferencesDialog: b }))
      }
    }, 0)
  }, [dispatch])

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Don't drag if clicking the close button
    if ((e.target as HTMLElement).closest('.preferences-close')) return
    if (!bounds) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, startLeft: bounds.x, startTop: bounds.y }
    setIsDragging(true)
  }

  const handleResizeMouseDown = (edge: string) => (e: React.MouseEvent) => {
    if (!bounds) return
    e.preventDefault()
    e.stopPropagation()
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: bounds.width,
      startHeight: bounds.height,
      startLeft: bounds.x,
      startTop: bounds.y,
      edge
    }
    setIsResizing(true)
  }

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

  const dialogStyle = bounds ? {
    position: 'absolute' as const,
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height
  } : undefined

  return (
    <div className="preferences-overlay" onClick={handleOverlayClick}>
      <div className="preferences-dialog" style={dialogStyle}>
        {/* Resize handles */}
        <div className="resize-handle resize-top" onMouseDown={handleResizeMouseDown('top')} />
        <div className="resize-handle resize-right" onMouseDown={handleResizeMouseDown('right')} />
        <div className="resize-handle resize-bottom" onMouseDown={handleResizeMouseDown('bottom')} />
        <div className="resize-handle resize-left" onMouseDown={handleResizeMouseDown('left')} />
        <div className="resize-handle resize-top-left" onMouseDown={handleResizeMouseDown('top-left')} />
        <div className="resize-handle resize-top-right" onMouseDown={handleResizeMouseDown('top-right')} />
        <div className="resize-handle resize-bottom-left" onMouseDown={handleResizeMouseDown('bottom-left')} />
        <div className="resize-handle resize-bottom-right" onMouseDown={handleResizeMouseDown('bottom-right')} />

        <div
          className="preferences-header"
          onMouseDown={handleHeaderMouseDown}
          style={{ cursor: 'move' }}
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
            className={`preferences-tab ${activeTab === 'themes' ? 'active' : ''}`}
            onClick={() => setActiveTab('themes')}
          >
            Theme Editor
          </button>
          <button
            className={`preferences-tab ${activeTab === 'shortcuts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            Keyboard Shortcuts
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

function clampBounds(x: number, y: number, width: number, height: number) {
  const maxW = window.innerWidth
  const maxH = window.innerHeight
  const w = Math.min(Math.max(width, MIN_WIDTH), maxW - 20)
  const h = Math.min(Math.max(height, MIN_HEIGHT), maxH - 20)
  const clampedX = Math.max(0, Math.min(x, maxW - w))
  const clampedY = Math.max(0, Math.min(y, maxH - h))
  return { x: clampedX, y: clampedY, width: w, height: h }
}
