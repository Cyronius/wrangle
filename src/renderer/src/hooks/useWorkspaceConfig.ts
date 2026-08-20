import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../store/store'
import { updateWorkspace, removeWorkspace } from '../store/workspacesSlice'
import { closeTabsByWorkspace, cleanupWorkspaceActiveTab } from '../store/tabsSlice'
import { DEFAULT_WORKSPACE_ID, WorkspaceState } from '../../../shared/workspace-types'

/**
 * SBR-005: per-workspace settings actions (rename, hidden files, close).
 * Redux updates are applied immediately; folder-backed workspaces also persist
 * the change to .wrangle/workspace.json.
 */
export function useWorkspaceConfig(workspace: WorkspaceState | undefined) {
  const dispatch = useDispatch<AppDispatch>()

  const persistConfig = useCallback(
    (changes: { name?: string; showHiddenFiles?: boolean }) => {
      if (!workspace?.rootPath) return
      const rootPath = workspace.rootPath
      window.electron.workspace.loadConfig(rootPath).then((config) => {
        if (config) {
          window.electron.workspace.saveConfig(rootPath, { ...config, ...changes })
        }
      })
    },
    [workspace?.rootPath]
  )

  const renameWorkspace = useCallback(
    (rawName: string) => {
      if (!workspace || !workspace.rootPath) return
      const trimmed = rawName.trim()
      // If empty, revert to folder basename
      const newName =
        trimmed || workspace.rootPath.split(/[/\\]/).filter(Boolean).pop() || 'Workspace'
      if (newName === workspace.name) return
      dispatch(updateWorkspace({ id: workspace.id, changes: { name: newName } }))
      persistConfig({ name: newName })
    },
    [dispatch, workspace, persistConfig]
  )

  const toggleHiddenFiles = useCallback(() => {
    if (!workspace) return
    const newValue = !workspace.showHiddenFiles
    dispatch(updateWorkspace({ id: workspace.id, changes: { showHiddenFiles: newValue } }))
    persistConfig({ showHiddenFiles: newValue })
  }, [dispatch, workspace, persistConfig])

  const closeWorkspace = useCallback(() => {
    if (!workspace || workspace.id === DEFAULT_WORKSPACE_ID) return
    const shouldClose = window.confirm(`Close workspace "${workspace.name}"?`)
    if (!shouldClose) return
    // Remove the workspace's tabs too — the active-workspace tab bar (WTB-014)
    // would otherwise leave them stranded in state
    dispatch(closeTabsByWorkspace(workspace.id))
    dispatch(cleanupWorkspaceActiveTab(workspace.id))
    dispatch(removeWorkspace(workspace.id))
    if (workspace.rootPath) {
      window.electron.workspace.unwatchFolder(workspace.rootPath)
    }
  }, [dispatch, workspace])

  return { renameWorkspace, toggleHiddenFiles, closeWorkspace }
}
