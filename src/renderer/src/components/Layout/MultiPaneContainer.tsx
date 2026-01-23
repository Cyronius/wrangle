import { useCallback } from 'react'
import { Allotment } from 'allotment'
import { useSelector, useDispatch } from 'react-redux'
import { RootState } from '../../store/store'
import { setFocusedPane } from '../../store/layoutSlice'
import { setActiveWorkspace } from '../../store/workspacesSlice'
import { WorkspacePane } from './WorkspacePane'
import 'allotment/dist/style.css'
import './multi-pane.css'

export function MultiPaneContainer() {
  const dispatch = useDispatch()
  const visiblePanes = useSelector((state: RootState) => state.layout.visiblePanes)
  const focusedPaneId = useSelector((state: RootState) => state.layout.focusedPaneId)

  const handlePaneFocus = useCallback((workspaceId: string) => {
    dispatch(setFocusedPane(workspaceId))
    dispatch(setActiveWorkspace(workspaceId))
  }, [dispatch])

  if (visiblePanes.length === 0) {
    return null
  }

  return (
    <div className="multi-pane-container">
      <Allotment>
        {visiblePanes.map((workspaceId) => (
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
