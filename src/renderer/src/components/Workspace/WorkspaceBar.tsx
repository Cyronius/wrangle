import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../../store/store'
import {
  selectAllWorkspaces,
  selectActiveWorkspaceId,
  addWorkspace,
  expandWorkspaceExclusive,
  setActiveWorkspace
} from '../../store/workspacesSlice'
import { setWorkspaceSidebar, setFocusedPane, addVisiblePane } from '../../store/layoutSlice'
import { WorkspaceState } from '../../../../shared/workspace-types'
import './workspace.css'

interface WorkspaceBarItemProps {
  workspace: WorkspaceState
  isActive: boolean
  onClick: () => void
}

function WorkspaceBarItem({ workspace, isActive, onClick }: WorkspaceBarItemProps) {
  return (
    <div
      className={`workspace-bar-item ${isActive ? 'active' : ''}`}
      style={{ backgroundColor: workspace.color }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Workspace: ${workspace.name}. Press Enter to expand.`}
      aria-expanded={workspace.isExpanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <span className="workspace-bar-name">{workspace.name}</span>
    </div>
  )
}

export function WorkspaceBar() {
  const dispatch = useDispatch<AppDispatch>()
  const workspaces = useSelector(selectAllWorkspaces)
  const activeWorkspaceId = useSelector(selectActiveWorkspaceId)
  const showWorkspaceSidebar = useSelector((state: RootState) => state.layout.showWorkspaceSidebar)
  const multiPaneEnabled = useSelector((state: RootState) => state.layout.multiPaneEnabled)
  const visiblePanes = useSelector((state: RootState) => state.layout.visiblePanes)

  const handleWorkspaceClick = (workspace: WorkspaceState) => {
    if (multiPaneEnabled) {
      // In multi-pane mode: focus existing pane or add as new pane
      if (visiblePanes.includes(workspace.id)) {
        dispatch(setFocusedPane(workspace.id))
        dispatch(setActiveWorkspace(workspace.id))
      } else {
        dispatch(addVisiblePane(workspace.id))
        dispatch(setActiveWorkspace(workspace.id))
      }
    } else {
      // Single-pane mode: toggle sidebar
      if (workspace.isExpanded && showWorkspaceSidebar) {
        dispatch(setWorkspaceSidebar(false))
      } else {
        dispatch(setActiveWorkspace(workspace.id))
        dispatch(expandWorkspaceExclusive(workspace.id))
        dispatch(setWorkspaceSidebar(true))
      }
    }
  }

  const handleAddWorkspace = async () => {
    // Get colors of existing workspaces to avoid duplicates
    const usedColors = workspaces.map((w) => w.color)

    // Open folder dialog
    const result = await window.electron.workspace.openFolder(usedColors)
    if (!result) return

    // Add to Redux store
    dispatch(
      addWorkspace({
        id: result.config.id,
        name: result.config.name,
        color: result.config.color,
        rootPath: result.path,
        isExpanded: true
      })
    )

    if (multiPaneEnabled) {
      // Add as new pane in multi-pane mode
      dispatch(addVisiblePane(result.config.id))
    } else {
      // Show sidebar for new workspace in single-pane mode
      dispatch(setWorkspaceSidebar(true))
    }
  }

  return (
    <div className="workspace-bar">
      {workspaces.map((workspace) => (
        <WorkspaceBarItem
          key={workspace.id}
          workspace={workspace}
          isActive={workspace.id === activeWorkspaceId}
          onClick={() => handleWorkspaceClick(workspace)}
        />
      ))}
      <div
        className="workspace-bar-add"
        onClick={handleAddWorkspace}
        role="button"
        tabIndex={0}
        aria-label="Add workspace"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleAddWorkspace()
          }
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
    </div>
  )
}
