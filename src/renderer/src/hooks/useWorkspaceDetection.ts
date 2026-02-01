import { useCallback } from 'react'
import { useSelector } from 'react-redux'
import { selectAllWorkspaces, selectActiveWorkspaceId } from '../store/workspacesSlice'
import { WorkspaceId, DEFAULT_WORKSPACE_ID } from '../../../shared/workspace-types'

/**
 * Hook to auto-detect which workspace a file belongs to based on its path.
 * Returns a function that takes a file path and returns the workspace ID.
 */
export function useWorkspaceDetection() {
  const workspaces = useSelector(selectAllWorkspaces)
  const activeWorkspaceId = useSelector(selectActiveWorkspaceId)

  /**
   * Determine which workspace a file path belongs to.
   * Checks if the file path is within any workspace's root path.
   * Falls back to the active workspace if no match is found.
   */
  const detectWorkspaceForPath = useCallback(
    (filePath: string | undefined): WorkspaceId => {
      if (!filePath) {
        return activeWorkspaceId || DEFAULT_WORKSPACE_ID
      }

      // Normalize path separators for comparison
      const normalizedFilePath = filePath.replace(/\\/g, '/')

      // Check non-default workspaces first (they have rootPath)
      for (const workspace of workspaces) {
        if (workspace.rootPath) {
          const normalizedRootPath = workspace.rootPath.replace(/\\/g, '/')
          if (normalizedFilePath.startsWith(normalizedRootPath + '/')) {
            return workspace.id
          }
        }
      }

      // Default to active workspace or default workspace
      return activeWorkspaceId || DEFAULT_WORKSPACE_ID
    },
    [workspaces, activeWorkspaceId]
  )

  /**
   * Check if a file path is inside a specific workspace.
   */
  const isPathInWorkspace = useCallback(
    (filePath: string, workspaceId: WorkspaceId): boolean => {
      const workspace = workspaces.find((w) => w.id === workspaceId)
      if (!workspace?.rootPath) return false

      const normalizedFilePath = filePath.replace(/\\/g, '/')
      const normalizedRootPath = workspace.rootPath.replace(/\\/g, '/')

      return normalizedFilePath.startsWith(normalizedRootPath + '/')
    },
    [workspaces]
  )

  return {
    detectWorkspaceForPath,
    isPathInWorkspace
  }
}
