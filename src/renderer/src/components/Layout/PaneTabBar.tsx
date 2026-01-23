import { useSelector, useDispatch } from 'react-redux'
import {
  setActiveTab,
  closeTab,
  selectTabsByWorkspace,
  selectActiveTabIdByWorkspace
} from '../../store/tabsSlice'
import { setActiveWorkspace } from '../../store/workspacesSlice'
import { setFocusedPane } from '../../store/layoutSlice'
import { Tab } from '../Tabs/Tab'
import type { RootState } from '../../store/store'
import type { WorkspaceId } from '../../../../shared/workspace-types'

interface PaneTabBarProps {
  workspaceId: WorkspaceId
  workspaceName: string
  workspaceColor: string
  isFocused: boolean
}

export function PaneTabBar({ workspaceId, workspaceName, workspaceColor, isFocused }: PaneTabBarProps) {
  const dispatch = useDispatch()
  const tabs = useSelector((state: RootState) => selectTabsByWorkspace(state, workspaceId))
  const activeTabId = useSelector((state: RootState) => selectActiveTabIdByWorkspace(state, workspaceId))

  const handleTabClick = (tabId: string) => {
    dispatch(setActiveTab(tabId))
    dispatch(setActiveWorkspace(workspaceId))
    dispatch(setFocusedPane(workspaceId))
  }

  const handleTabClose = async (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()

    const tab = tabs.find(t => t.id === tabId)
    if (tab?.isDirty) {
      const shouldClose = window.confirm(`"${tab.filename}" has unsaved changes. Close anyway?`)
      if (!shouldClose) return
    }

    if (tab && !tab.path) {
      await window.electron.file.cleanupTemp(tabId)
    }

    dispatch(closeTab(tabId))
  }

  if (tabs.length === 0) {
    return (
      <div
        className="pane-tab-bar pane-tab-bar-empty"
        style={{ '--pane-color': workspaceColor } as React.CSSProperties}
      >
        <span className="pane-tab-bar-label">{workspaceName}</span>
      </div>
    )
  }

  return (
    <div
      className={`pane-tab-bar ${isFocused ? 'pane-tab-bar-focused' : ''}`}
      style={{ '--pane-color': workspaceColor } as React.CSSProperties}
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          id={tab.id}
          filename={tab.displayTitle || tab.filename}
          isDirty={tab.isDirty}
          isActive={tab.id === activeTabId}
          onClick={() => handleTabClick(tab.id)}
          onClose={(e) => handleTabClose(e, tab.id)}
          title={tab.path || tab.filename}
        />
      ))}
    </div>
  )
}
