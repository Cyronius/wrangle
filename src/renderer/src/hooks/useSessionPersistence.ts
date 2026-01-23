import { useEffect, useRef, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store/store'
import { TabDocument } from '../store/tabsSlice'
import { DEFAULT_WORKSPACE_ID, WorkspaceSession, TabState } from '../../../shared/workspace-types'

/**
 * Converts Redux TabDocument[] into WorkspaceSession TabState[] for persistence.
 * Only persists content for unsaved dirty tabs (no path).
 */
function buildWorkspaceSession(
  tabs: TabDocument[],
  activeTabId: string | null,
  viewMode: string,
  splitRatio: number
): WorkspaceSession {
  return {
    tabs: tabs.map((tab): TabState => ({
      id: tab.id,
      path: tab.path,
      filename: tab.filename,
      content: tab.isDirty && !tab.path ? tab.content : undefined,
      isDirty: tab.isDirty,
      displayTitle: tab.displayTitle,
      cursorPosition: tab.cursorPosition,
      scrollPosition: tab.scrollTop
    })),
    activeTabId,
    viewMode: viewMode as WorkspaceSession['viewMode'],
    splitRatio,
    lastSavedAt: Date.now()
  }
}

/**
 * Hook that auto-saves session state with debouncing.
 * Saves workspace sessions and app-level session on state changes and before unload.
 */
export function useSessionPersistence() {
  const tabs = useSelector((state: RootState) => state.tabs.tabs)
  const activeTabIdByWorkspace = useSelector((state: RootState) => state.tabs.activeTabIdByWorkspace)
  const workspaces = useSelector((state: RootState) => state.workspaces.workspaces)
  const activeWorkspaceId = useSelector((state: RootState) => state.workspaces.activeWorkspaceId)
  const viewMode = useSelector((state: RootState) => state.layout.viewMode)
  const splitRatio = useSelector((state: RootState) => state.layout.splitRatio)
  const multiPaneEnabled = useSelector((state: RootState) => state.layout.multiPaneEnabled)
  const visiblePanes = useSelector((state: RootState) => state.layout.visiblePanes)
  const focusedPaneId = useSelector((state: RootState) => state.layout.focusedPaneId)

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Use refs for the save function to avoid stale closures in beforeunload
  const tabsRef = useRef(tabs)
  const activeTabIdByWorkspaceRef = useRef(activeTabIdByWorkspace)
  const workspacesRef = useRef(workspaces)
  const activeWorkspaceIdRef = useRef(activeWorkspaceId)
  const viewModeRef = useRef(viewMode)
  const splitRatioRef = useRef(splitRatio)
  const multiPaneEnabledRef = useRef(multiPaneEnabled)
  const visiblePanesRef = useRef(visiblePanes)
  const focusedPaneIdRef = useRef(focusedPaneId)

  tabsRef.current = tabs
  activeTabIdByWorkspaceRef.current = activeTabIdByWorkspace
  workspacesRef.current = workspaces
  activeWorkspaceIdRef.current = activeWorkspaceId
  viewModeRef.current = viewMode
  splitRatioRef.current = splitRatio
  multiPaneEnabledRef.current = multiPaneEnabled
  visiblePanesRef.current = visiblePanes
  focusedPaneIdRef.current = focusedPaneId

  const saveAllSessions = useCallback(async () => {
    const currentTabs = tabsRef.current
    const currentActiveTabIds = activeTabIdByWorkspaceRef.current
    const currentWorkspaces = workspacesRef.current
    const currentActiveWorkspaceId = activeWorkspaceIdRef.current
    const currentViewMode = viewModeRef.current
    const currentSplitRatio = splitRatioRef.current
    const currentMultiPaneEnabled = multiPaneEnabledRef.current
    const currentVisiblePanes = visiblePanesRef.current
    const currentFocusedPaneId = focusedPaneIdRef.current

    // Save session for each workspace
    for (const workspace of currentWorkspaces) {
      const workspaceTabs = currentTabs.filter(t => t.workspaceId === workspace.id)
      const activeTabId = currentActiveTabIds[workspace.id] || null

      const session = buildWorkspaceSession(workspaceTabs, activeTabId, currentViewMode, currentSplitRatio)

      if (workspace.id === DEFAULT_WORKSPACE_ID) {
        await window.electron.workspace.saveDefaultSession(session)
      } else if (workspace.rootPath) {
        await window.electron.workspace.saveSession(workspace.rootPath, session)
      }
    }

    // Save app-level session (which workspaces are open + multi-pane state)
    const openWorkspaces = currentWorkspaces
      .filter(w => w.id !== DEFAULT_WORKSPACE_ID && w.rootPath)
      .map(w => w.rootPath!)

    const activeWorkspace = currentWorkspaces.find(w => w.id === currentActiveWorkspaceId)

    // Resolve workspace IDs to paths for multi-pane persistence
    const visiblePaneWorkspacePaths = currentVisiblePanes
      .map(id => currentWorkspaces.find(w => w.id === id)?.rootPath)
      .filter((p): p is string => p != null)

    const focusedPaneWorkspace = currentFocusedPaneId
      ? currentWorkspaces.find(w => w.id === currentFocusedPaneId)
      : null

    await window.electron.workspace.saveAppSession({
      openWorkspaces,
      activeWorkspacePath: activeWorkspace?.rootPath || null,
      lastSavedAt: Date.now(),
      multiPaneEnabled: currentMultiPaneEnabled,
      visiblePaneWorkspacePaths,
      focusedPaneWorkspacePath: focusedPaneWorkspace?.rootPath || null
    })
  }, [])

  // Debounced save - triggers 5 seconds after last state change
  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveAllSessions()
    }, 5000)
  }, [saveAllSessions])

  // Watch for relevant state changes and schedule saves
  useEffect(() => {
    scheduleSave()
  }, [tabs, activeTabIdByWorkspace, workspaces, activeWorkspaceId, viewMode, splitRatio, multiPaneEnabled, visiblePanes, focusedPaneId, scheduleSave])

  // Save immediately before window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Cancel any pending debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      // Save synchronously isn't possible with async IPC, but we fire and forget
      saveAllSessions()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [saveAllSessions])
}
