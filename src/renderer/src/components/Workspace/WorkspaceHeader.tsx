import { useState, useRef, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../../store/store'
import { updateWorkspace, removeWorkspace, collapseAllWorkspaces } from '../../store/workspacesSlice'
import { setWorkspaceSidebar } from '../../store/layoutSlice'
import { WorkspaceState, DEFAULT_WORKSPACE_ID, WORKSPACE_COLORS } from '../../../../shared/workspace-types'
import './workspace.css'

interface WorkspaceHeaderProps {
  workspace: WorkspaceState
}

// Chevron left icon for collapse
function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

// X icon for close
function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function WorkspaceHeader({ workspace }: WorkspaceHeaderProps) {
  const dispatch = useDispatch<AppDispatch>()
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(workspace.name)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  const isDefault = workspace.id === DEFAULT_WORKSPACE_ID

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  // Close color picker when clicking outside
  useEffect(() => {
    if (!showColorPicker) return

    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColorPicker])

  const handleNameDoubleClick = () => {
    if (!isDefault) {
      setEditedName(workspace.name)
      setIsEditingName(true)
    }
  }

  const handleNameSubmit = () => {
    const trimmed = editedName.trim()
    if (trimmed && trimmed !== workspace.name) {
      dispatch(updateWorkspace({ id: workspace.id, changes: { name: trimmed } }))
      // Also save to config file
      if (workspace.rootPath) {
        window.electron.workspace.loadConfig(workspace.rootPath).then((config) => {
          if (config) {
            window.electron.workspace.saveConfig(workspace.rootPath!, {
              ...config,
              name: trimmed
            })
          }
        })
      }
    }
    setIsEditingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit()
    } else if (e.key === 'Escape') {
      setEditedName(workspace.name)
      setIsEditingName(false)
    }
  }

  const handleColorChange = (color: string) => {
    dispatch(updateWorkspace({ id: workspace.id, changes: { color } }))
    setShowColorPicker(false)

    // Also save to config file
    if (workspace.rootPath) {
      window.electron.workspace.loadConfig(workspace.rootPath).then((config) => {
        if (config) {
          window.electron.workspace.saveConfig(workspace.rootPath!, {
            ...config,
            color
          })
        }
      })
    }
  }

  const handleCollapse = () => {
    dispatch(collapseAllWorkspaces())
    dispatch(setWorkspaceSidebar(false))
  }

  const handleClose = () => {
    if (isDefault) return

    // Close workspace
    dispatch(removeWorkspace(workspace.id))

    // Stop file watcher if watching
    if (workspace.rootPath) {
      window.electron.workspace.unwatchFolder(workspace.rootPath)
    }

    // Collapse sidebar
    dispatch(collapseAllWorkspaces())
    dispatch(setWorkspaceSidebar(false))
  }

  // Calculate header tint from workspace color
  const headerStyle = {
    '--workspace-header-tint': `${workspace.color}20`
  } as React.CSSProperties

  return (
    <div className="workspace-header" style={headerStyle}>
      <div className="workspace-header-row">
        {/* Color picker */}
        <div className="workspace-color-picker" ref={colorPickerRef}>
          <div
            className="workspace-color-swatch"
            style={{ backgroundColor: workspace.color }}
            onClick={() => !isDefault && setShowColorPicker(!showColorPicker)}
            role="button"
            aria-label="Change workspace color"
            tabIndex={isDefault ? -1 : 0}
          />
          {showColorPicker && (
            <div className="workspace-color-dropdown">
              {WORKSPACE_COLORS.map((color) => (
                <div
                  key={color}
                  className={`workspace-color-option ${color === workspace.color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorChange(color)}
                  role="button"
                  aria-label={`Select color ${color}`}
                  tabIndex={0}
                />
              ))}
            </div>
          )}
        </div>

        {/* Name (editable for non-default workspaces) */}
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            className="workspace-name-input"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
          />
        ) : (
          <span
            className={`workspace-name ${!isDefault ? 'editable' : ''}`}
            onDoubleClick={handleNameDoubleClick}
            title={isDefault ? 'Default workspace' : 'Double-click to rename'}
          >
            {workspace.name}
          </span>
        )}

        {/* Collapse button */}
        <button
          className="workspace-header-btn"
          onClick={handleCollapse}
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <ChevronLeftIcon />
        </button>

        {/* Close button (disabled for default workspace) */}
        <button
          className="workspace-header-btn"
          onClick={handleClose}
          disabled={isDefault}
          title={isDefault ? 'Cannot close default workspace' : 'Close workspace'}
          aria-label="Close workspace"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  )
}
