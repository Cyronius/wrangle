import { useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store/store'
import { setFocusedPane, setPaneSplitRatio, ViewMode } from '../../store/layoutSlice'
import { selectWorkspaceById, setActiveWorkspace } from '../../store/workspacesSlice'
import { useEditorPane } from '../../hooks/useEditorPane'
import { useImageDrop } from '../../hooks/useImageDrop'
import { updateTab, closeTab, setActiveTab, selectTabsByWorkspace, selectActiveTabIdByWorkspace } from '../../store/tabsSlice'
import { getMonacoThemeName } from '../../utils/monaco-theme-generator'
import { EditorLayout } from './EditorLayout'
import { TabGroup } from '../Tabs/TabGroup'
import { WindowControls } from '../UI/WindowControls'
import type { WorkspaceId } from '../../../../shared/workspace-types'

interface WorkspacePaneProps {
  workspaceId: WorkspaceId
  isFocused: boolean
  onFocus: () => void
  showWindowControls?: boolean
}

export function WorkspacePane({ workspaceId, isFocused, onFocus, showWindowControls }: WorkspacePaneProps) {
  const dispatch = useDispatch()
  const workspace = useSelector((state: RootState) => selectWorkspaceById(state, workspaceId))
  const workspaceTabs = useSelector((state: RootState) => selectTabsByWorkspace(state, workspaceId))
  const activeTabId = useSelector((state: RootState) => selectActiveTabIdByWorkspace(state, workspaceId))
  const paneViewMode = useSelector((state: RootState) => state.layout.paneViewModes[workspaceId])
  const paneSplitRatio = useSelector((state: RootState) => state.layout.paneSplitRatios[workspaceId])
  const globalViewMode = useSelector((state: RootState) => state.layout.viewMode)
  const globalSplitRatio = useSelector((state: RootState) => state.layout.splitRatio)
  const theme = useSelector((state: RootState) => state.settings.theme.current)
  const {
    editorRef,
    content,
    baseDir,
    currentFilePath,
    activeTab,
    handleChange,
    handleCursorPositionChange,
    handleScrollTopChange
  } = useEditorPane(workspaceId)

  // Image drop support
  const { isDragging } = useImageDrop({
    editorRef,
    tabId: activeTab?.id,
    currentFilePath,
    onImageInsert: () => {
      if (activeTab) {
        dispatch(updateTab({ id: activeTab.id, isDirty: true }))
      }
    }
  })

  const handlePaneClick = useCallback(() => {
    if (!isFocused) {
      onFocus()
    }
  }, [isFocused, onFocus])

  const handleTabClick = useCallback((tabId: string) => {
    dispatch(setActiveTab(tabId))
    dispatch(setActiveWorkspace(workspaceId))
    dispatch(setFocusedPane(workspaceId))
  }, [dispatch, workspaceId])

  const handleTabClose = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    const tab = workspaceTabs.find((t) => t.id === tabId)
    if (tab?.isDirty) {
      const shouldClose = window.confirm(
        `"${tab.filename}" has unsaved changes. Close anyway?`
      )
      if (!shouldClose) return
    }
    // Clean up temp directory if tab was never saved
    if (tab && !tab.path) {
      window.electron.file.cleanupTemp(tabId)
    }
    dispatch(closeTab(tabId))
  }, [dispatch, workspaceTabs])

  // Use per-pane settings if set, otherwise fall back to global
  const viewMode: ViewMode = paneViewMode || globalViewMode
  const splitRatio = paneSplitRatio ?? globalSplitRatio
  const monacoTheme = getMonacoThemeName(theme)

  if (!workspace) return null

  return (
    <div
      className={`workspace-pane ${isFocused ? 'workspace-pane-focused' : ''}`}
      style={{ '--pane-color': workspace.color } as React.CSSProperties}
      onClick={handlePaneClick}
      onFocus={handlePaneClick}
    >
      <div className="workspace-pane-tab-row">
        {workspaceTabs.length > 0 && (
          <TabGroup
            workspaceId={workspaceId}
            workspaceName={workspace.name}
            workspaceColor={workspace.color}
            tabs={workspaceTabs}
            activeTabId={activeTabId}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
          />
        )}
        {showWindowControls && <WindowControls />}
      </div>
      <div
        className="workspace-toolbar-bar"
        style={{ backgroundColor: workspace.color, opacity: isFocused ? 1 : 0.85 }}
      >
        <span className="workspace-toolbar-bar-name">{workspace.name}</span>
      </div>
      <div className="workspace-pane-content">
        {isDragging && (
          <div className="workspace-pane-drop-overlay">
            Drop images here
          </div>
        )}
        {activeTab ? (
          <EditorLayout
            content={content}
            onChange={handleChange}
            baseDir={baseDir}
            theme={monacoTheme}
            editorRef={editorRef}
            onCursorPositionChange={handleCursorPositionChange}
            onScrollTopChange={handleScrollTopChange}
            viewModeOverride={viewMode}
            splitRatioOverride={splitRatio}
            onSplitRatioChange={(ratio) => {
              dispatch(setPaneSplitRatio({ paneId: workspaceId, ratio }))
            }}
          />
        ) : (
          <div className="workspace-pane-empty">
            <span>No open files</span>
          </div>
        )}
      </div>
    </div>
  )
}
