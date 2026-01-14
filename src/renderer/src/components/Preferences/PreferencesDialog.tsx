import { useState, useEffect, useCallback } from 'react'
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

  return (
    <div className="preferences-overlay" onClick={handleOverlayClick}>
      <div className="preferences-dialog">
        <div className="preferences-header">
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
