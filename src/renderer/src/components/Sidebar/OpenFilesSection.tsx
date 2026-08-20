import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../../store/store'
import { toggleWorkspaceExpanded } from '../../store/workspacesSlice'
import { DEFAULT_WORKSPACE_ID } from '../../../../shared/workspace-types'
import { DefaultWorkspaceFileList } from '../Workspace/DefaultWorkspaceFileList'

// SBR-003: collapsible section listing default-workspace (loose) tabs.
// The parent only renders this when the default workspace has tabs.
export function OpenFilesSection() {
  const dispatch = useDispatch<AppDispatch>()
  const isExpanded = useSelector(
    (state: RootState) =>
      state.workspaces.workspaces.find((w) => w.id === DEFAULT_WORKSPACE_ID)?.isExpanded ?? true
  )

  return (
    <div className="workspace-section open-files-section">
      <div
        className="workspace-section-header"
        onClick={() => dispatch(toggleWorkspaceExpanded(DEFAULT_WORKSPACE_ID))}
        role="button"
        aria-expanded={isExpanded}
      >
        <svg
          className={`sidebar-section-chevron ${isExpanded ? 'expanded' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="workspace-section-name">Open Files</span>
      </div>
      {isExpanded && (
        <div className="workspace-section-body">
          <DefaultWorkspaceFileList />
        </div>
      )}
    </div>
  )
}
