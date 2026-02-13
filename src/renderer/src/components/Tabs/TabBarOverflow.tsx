import { useState, useRef, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { WorkspaceState } from '../../../../shared/workspace-types'
import { setActiveWorkspace, setVisibleInTabBar } from '../../store/workspacesSlice'

interface TabBarOverflowProps {
  overflowWorkspaces: WorkspaceState[]
  tabCountByWorkspace: Map<string, number>
}

/**
 * WTB-007: Overflow dropdown for hidden workspaces
 * Shows when too many workspaces are visible to fit at their minimum widths.
 */
export function TabBarOverflow({ overflowWorkspaces, tabCountByWorkspace }: TabBarOverflowProps) {
  const dispatch = useDispatch()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close dropdown on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (overflowWorkspaces.length === 0) return null

  const handleWorkspaceClick = (workspace: WorkspaceState) => {
    // Make the workspace visible and active
    dispatch(setVisibleInTabBar({ id: workspace.id, visible: true }))
    dispatch(setActiveWorkspace(workspace.id))
    setIsOpen(false)
  }

  return (
    <div className="tab-bar-overflow" ref={dropdownRef}>
      <button
        className="tab-bar-overflow-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`${overflowWorkspaces.length} hidden workspaces`}
      >
        +{overflowWorkspaces.length}
      </button>

      {isOpen && (
        <div className="tab-bar-overflow-dropdown" role="menu">
          {overflowWorkspaces.map((ws) => (
            <button
              key={ws.id}
              className="tab-bar-overflow-item"
              onClick={() => handleWorkspaceClick(ws)}
              role="menuitem"
            >
              <span
                className="tab-bar-overflow-color"
                style={{ backgroundColor: ws.color }}
              />
              <span className="tab-bar-overflow-name">{ws.name}</span>
              <span className="tab-bar-overflow-count">
                {tabCountByWorkspace.get(ws.id) || 0} tabs
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
