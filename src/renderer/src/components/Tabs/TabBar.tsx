import { useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  setActiveTab,
  closeTab,
  selectAllTabs,
  selectActiveTabIdByWorkspace
} from '../../store/tabsSlice'
import {
  selectAllWorkspaces,
  selectActiveWorkspaceId,
  setActiveWorkspace
} from '../../store/workspacesSlice'
import { TabGroup } from './TabGroup'
import type { RootState } from '../../store/store'
import type { WorkspaceId } from '../../../shared/workspace-types'
import './tabs.css'

interface TabBarProps {
  onCloseTab?: (tabId: string) => void
}

export function TabBar({ onCloseTab }: TabBarProps) {
  const dispatch = useDispatch()
  const tabs = useSelector(selectAllTabs)
  const workspaces = useSelector(selectAllWorkspaces)

  // Group tabs by workspace
  const tabsByWorkspace = useMemo(() => {
    const grouped = new Map<WorkspaceId, typeof tabs>()

    // Initialize groups for all workspaces (even empty ones won't show)
    workspaces.forEach((ws) => {
      grouped.set(ws.id, [])
    })

    // Distribute tabs to their workspaces
    tabs.forEach((tab) => {
      const workspaceTabs = grouped.get(tab.workspaceId) || []
      workspaceTabs.push(tab)
      grouped.set(tab.workspaceId, workspaceTabs)
    })

    return grouped
  }, [tabs, workspaces])

  // Get workspaces that have tabs (in order)
  const workspacesWithTabs = useMemo(() => {
    return workspaces.filter((ws) => {
      const wsTabs = tabsByWorkspace.get(ws.id)
      return wsTabs && wsTabs.length > 0
    })
  }, [workspaces, tabsByWorkspace])

  const handleTabClick = (tabId: string, workspaceId: WorkspaceId) => {
    dispatch(setActiveTab(tabId))
    dispatch(setActiveWorkspace(workspaceId))
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

  if (tabs.length === 0) {
    return null
  }

  return (
    <div className="tab-bar">
      {workspacesWithTabs.map((workspace) => {
        const workspaceTabs = tabsByWorkspace.get(workspace.id) || []
        return (
          <TabGroupWrapper
            key={workspace.id}
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            workspaceColor={workspace.color}
            tabs={workspaceTabs}
            onTabClick={(tabId) => handleTabClick(tabId, workspace.id)}
            onTabClose={handleTabClose}
          />
        )
      })}
    </div>
  )
}

// Wrapper component to use selector with workspace ID
function TabGroupWrapper({
  workspaceId,
  workspaceName,
  workspaceColor,
  tabs,
  onTabClick,
  onTabClose
}: {
  workspaceId: WorkspaceId
  workspaceName: string
  workspaceColor: string
  tabs: ReturnType<typeof selectAllTabs>
  onTabClick: (tabId: string) => void
  onTabClose: (e: React.MouseEvent, tabId: string) => void
}) {
  const activeWorkspaceId = useSelector(selectActiveWorkspaceId)
  const activeTabId = useSelector((state: RootState) =>
    selectActiveTabIdByWorkspace(state, workspaceId)
  )

  // Only show the active indicator if this workspace is the currently visible one
  const effectiveActiveTabId = workspaceId === activeWorkspaceId ? activeTabId : null

  return (
    <TabGroup
      workspaceId={workspaceId}
      workspaceName={workspaceName}
      workspaceColor={workspaceColor}
      tabs={tabs}
      activeTabId={effectiveActiveTabId}
      onTabClick={onTabClick}
      onTabClose={onTabClose}
    />
  )
}
