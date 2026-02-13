import { useCallback, useEffect } from 'react'
import { Allotment } from 'allotment'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store/store'
import { setFocusedPane, setPaneWidthRatios } from '../../store/layoutSlice'
import { selectVisibleWorkspaceIds, setActiveWorkspace } from '../../store/workspacesSlice'
import { WorkspacePane } from './WorkspacePane'
import 'allotment/dist/style.css'
import './multi-pane.css'

export function MultiPaneContainer() {
  const dispatch = useDispatch()
  const visiblePaneIds = useSelector(selectVisibleWorkspaceIds)
  const focusedPaneId = useSelector((state: RootState) => state.layout.focusedPaneId)

  // Auto-correct focusedPaneId if it references a now-hidden workspace
  useEffect(() => {
    if (focusedPaneId && !visiblePaneIds.includes(focusedPaneId)) {
      if (visiblePaneIds.length > 0) {
        dispatch(setFocusedPane(visiblePaneIds[0]))
      }
    } else if (!focusedPaneId && visiblePaneIds.length > 0) {
      dispatch(setFocusedPane(visiblePaneIds[0]))
    }
  }, [visiblePaneIds, focusedPaneId, dispatch])

  const handlePaneFocus = useCallback((workspaceId: string) => {
    dispatch(setFocusedPane(workspaceId))
    dispatch(setActiveWorkspace(workspaceId))
  }, [dispatch])

  const handleSizeChange = useCallback((sizes: number[]) => {
    const total = sizes.reduce((a, b) => a + b, 0)
    if (total > 0) {
      const ratios = sizes.map((s) => s / total)
      dispatch(setPaneWidthRatios(ratios))
    }
  }, [dispatch])

  if (visiblePaneIds.length === 0) {
    return null
  }

  return (
    <div className="multi-pane-container">
      <Allotment onChange={handleSizeChange}>
        {visiblePaneIds.map((workspaceId) => (
          <Allotment.Pane key={workspaceId} minSize={250}>
            <WorkspacePane
              workspaceId={workspaceId}
              isFocused={workspaceId === focusedPaneId}
              onFocus={() => handlePaneFocus(workspaceId)}
            />
          </Allotment.Pane>
        ))}
      </Allotment>
    </div>
  )
}
