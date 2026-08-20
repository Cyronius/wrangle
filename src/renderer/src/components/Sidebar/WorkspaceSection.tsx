import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../../store/store'
import {
  setActiveWorkspace,
  toggleWorkspaceExpanded
} from '../../store/workspacesSlice'
import { WorkspaceState } from '../../../../shared/workspace-types'
import { FileTree } from '../Workspace/FileTree'

interface WorkspaceSectionProps {
  workspace: WorkspaceState
  onFileOpen: (filePath: string) => void
  selectedPath?: string
  openPaths: Set<string>
  onOpenSettings: (workspaceId: string, anchorRect: DOMRect) => void
}

// SBR-001/SBR-004: one collapsible sidebar section per folder workspace.
// Header click toggles collapse only; clicking into the body activates the
// workspace (which swaps the tab bar to its tabs, WTB-014).
export function WorkspaceSection({
  workspace,
  onFileOpen,
  selectedPath,
  openPaths,
  onOpenSettings
}: WorkspaceSectionProps) {
  const dispatch = useDispatch<AppDispatch>()
  const isActive = useSelector(
    (state: RootState) => state.workspaces.activeWorkspaceId === workspace.id
  )

  const handleBodyMouseDown = () => {
    if (!isActive) {
      dispatch(setActiveWorkspace(workspace.id))
    }
  }

  return (
    <div
      className={`workspace-section ${isActive ? 'active' : ''}`}
      data-workspace-id={workspace.id}
    >
      <div
        className="workspace-section-header"
        onClick={() => dispatch(toggleWorkspaceExpanded(workspace.id))}
        role="button"
        aria-expanded={workspace.isExpanded}
        title={workspace.rootPath ?? undefined}
      >
        <svg
          className={`sidebar-section-chevron ${workspace.isExpanded ? 'expanded' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="workspace-section-name">{workspace.name}</span>
        <button
          className="workspace-section-gear"
          onClick={(e) => {
            // SBR-004: gear opens settings only — no collapse, no activation
            e.stopPropagation()
            onOpenSettings(workspace.id, e.currentTarget.getBoundingClientRect())
          }}
          title="Workspace settings"
          aria-label={`Settings for workspace ${workspace.name}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
      {workspace.isExpanded && workspace.rootPath && (
        <div className="workspace-section-body" onMouseDown={handleBodyMouseDown}>
          <FileTree
            rootPath={workspace.rootPath}
            workspaceId={workspace.id}
            onFileOpen={onFileOpen}
            selectedPath={selectedPath}
            showHiddenFiles={workspace.showHiddenFiles}
            openPaths={openPaths}
          />
        </div>
      )}
    </div>
  )
}
