import { useState, useEffect, useRef } from 'react'
import { WorkspaceState } from '../../../../shared/workspace-types'
import { useWorkspaceConfig } from '../../hooks/useWorkspaceConfig'

interface WorkspaceSettingsPopoverProps {
  workspace: WorkspaceState
  anchorRect: DOMRect
  onClose: () => void
}

// SBR-005: gear-triggered settings popover for one workspace.
// Fixed positioning escapes the scrollable workspace column's overflow clipping.
export function WorkspaceSettingsPopover({
  workspace,
  anchorRect,
  onClose
}: WorkspaceSettingsPopoverProps) {
  const { renameWorkspace, toggleHiddenFiles, closeWorkspace } =
    useWorkspaceConfig(workspace)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [nameValue, setNameValue] = useState(workspace.name)

  // Dismiss on outside mousedown or Escape
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Anchor below the gear, clamped to the viewport
  const POPOVER_WIDTH = 240
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - POPOVER_WIDTH - 8))
  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 8)

  return (
    <div
      ref={popoverRef}
      className="workspace-settings-popover"
      style={{ position: 'fixed', top, left, width: POPOVER_WIDTH, zIndex: 1000 }}
      role="dialog"
      aria-label={`Settings for workspace ${workspace.name}`}
    >
      <div className="workspace-settings-field">
        <label className="workspace-settings-label">Workspace name</label>
        <input
          className="workspace-settings-name-input"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              renameWorkspace(nameValue)
              onClose()
            }
            if (e.key === 'Escape') {
              e.stopPropagation()
              setNameValue(workspace.name)
              onClose()
            }
          }}
          onBlur={() => renameWorkspace(nameValue)}
        />
      </div>

      <label className="workspace-settings-hidden-toggle">
        <input
          type="checkbox"
          checked={workspace.showHiddenFiles}
          onChange={toggleHiddenFiles}
        />
        Show hidden files
      </label>

      <div className="workspace-settings-separator" />

      <button
        className="workspace-settings-close-btn"
        onClick={() => {
          closeWorkspace()
          onClose()
        }}
      >
        Close Workspace
      </button>
    </div>
  )
}
