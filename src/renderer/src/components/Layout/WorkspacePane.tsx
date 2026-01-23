import { useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store/store'
import { setPaneSplitRatio, ViewMode } from '../../store/layoutSlice'
import { selectWorkspaceById } from '../../store/workspacesSlice'
import { useEditorPane } from '../../hooks/useEditorPane'
import { useImageDrop } from '../../hooks/useImageDrop'
import { updateTab } from '../../store/tabsSlice'
import { EditorLayout } from './EditorLayout'
import { PaneTabBar } from './PaneTabBar'
import type { WorkspaceId } from '../../../../shared/workspace-types'

interface WorkspacePaneProps {
  workspaceId: WorkspaceId
  isFocused: boolean
  onFocus: () => void
}

export function WorkspacePane({ workspaceId, isFocused, onFocus }: WorkspacePaneProps) {
  const dispatch = useDispatch()
  const workspace = useSelector((state: RootState) => selectWorkspaceById(state, workspaceId))
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

  // Use per-pane settings if set, otherwise fall back to global
  const viewMode: ViewMode = paneViewMode || globalViewMode
  const splitRatio = paneSplitRatio ?? globalSplitRatio
  const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark'

  if (!workspace) return null

  return (
    <div
      className={`workspace-pane ${isFocused ? 'workspace-pane-focused' : ''}`}
      style={{ '--pane-color': workspace.color } as React.CSSProperties}
      onClick={handlePaneClick}
      onFocus={handlePaneClick}
    >
      <PaneTabBar
        workspaceId={workspaceId}
        workspaceName={workspace.name}
        workspaceColor={workspace.color}
        isFocused={isFocused}
      />
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
