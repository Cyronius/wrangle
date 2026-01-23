import { useSelector } from 'react-redux'
import { selectAllWorkspaces, selectActiveWorkspaceId } from '../../store/workspacesSlice'
import { selectActiveTab } from '../../store/tabsSlice'
import { WorkspaceHeader } from './WorkspaceHeader'
import { FileTree } from './FileTree'
import { DEFAULT_WORKSPACE_ID } from '../../../../shared/workspace-types'
import './workspace.css'

interface WorkspaceSidebarProps {
  onFileOpen: (filePath: string) => void
}

// Folder icon for empty state
function FolderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      style={{ width: 48, height: 48, opacity: 0.3 }}
    >
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  )
}

export function WorkspaceSidebar({ onFileOpen }: WorkspaceSidebarProps) {
  const workspaces = useSelector(selectAllWorkspaces)
  const activeWorkspaceId = useSelector(selectActiveWorkspaceId)
  const activeTab = useSelector(selectActiveTab)

  // Find the expanded workspace
  const expandedWorkspace = workspaces.find((w) => w.isExpanded)

  // If no workspace is expanded, don't render
  if (!expandedWorkspace) {
    return null
  }

  const isDefault = expandedWorkspace.id === DEFAULT_WORKSPACE_ID

  return (
    <div className="workspace-sidebar">
      <WorkspaceHeader workspace={expandedWorkspace} />

      {isDefault || !expandedWorkspace.rootPath ? (
        // Empty state for default workspace (no folder)
        <div className="workspace-sidebar-empty">
          <FolderIcon />
          <p className="workspace-sidebar-empty-text">
            {isDefault
              ? 'The default workspace holds files not associated with any folder.'
              : 'No folder selected for this workspace.'}
          </p>
        </div>
      ) : (
        // File tree for workspaces with a root path
        <FileTree
          rootPath={expandedWorkspace.rootPath}
          workspaceId={expandedWorkspace.id}
          onFileOpen={onFileOpen}
          selectedPath={activeTab?.path}
        />
      )}
    </div>
  )
}
