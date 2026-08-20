import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  setActiveTab,
  closeTab,
  selectActiveWorkspaceTabs,
  selectActiveTabIdByWorkspace
} from '../../store/tabsSlice'
import {
  selectActiveWorkspace,
  selectActiveWorkspaceId
} from '../../store/workspacesSlice'
import { TabGroup } from './TabGroup'
import { TabContextMenu } from './TabContextMenu'
import type { RootState } from '../../store/store'
import './tabs.css'

interface TabBarProps {
  onCloseTab?: (tabId: string) => void
}

export function TabBar({ onCloseTab }: TabBarProps) {
  const dispatch = useDispatch()
  const activeWorkspaceId = useSelector(selectActiveWorkspaceId)
  const activeWorkspace = useSelector(selectActiveWorkspace)
  const tabs = useSelector(selectActiveWorkspaceTabs)
  // WTB-009: each workspace remembers its own active tab across switches
  const activeTabId = useSelector((state: RootState) =>
    selectActiveTabIdByWorkspace(state, activeWorkspaceId)
  )

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    tabId: string
    position: { x: number; y: number }
  } | null>(null)

  const handleTabContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      tabId,
      position: { x: e.clientX, y: e.clientY }
    })
  }

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()

    // Check if tab has unsaved changes
    const tab = tabs.find((t) => t.id === tabId)
    if (tab?.isDirty) {
      const shouldClose = window.confirm(
        `"${tab.filename}" has unsaved changes. Close anyway?`
      )
      if (!shouldClose) return
    }

    // Notify parent if callback provided
    if (onCloseTab) {
      onCloseTab(tabId)
    }

    dispatch(closeTab(tabId))
  }

  if (tabs.length === 0 || !activeWorkspace) {
    return null
  }

  return (
    <div className="tab-bar">
      <TabGroup
        workspaceId={activeWorkspace.id}
        workspaceName={activeWorkspace.name}
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={(tabId) => dispatch(setActiveTab(tabId))}
        onTabClose={handleTabClose}
        onTabContextMenu={handleTabContextMenu}
      />
      {contextMenu && (
        <TabContextMenu
          tabId={contextMenu.tabId}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
