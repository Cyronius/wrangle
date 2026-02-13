import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
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
import { TabBarOverflow } from './TabBarOverflow'
import type { RootState } from '../../store/store'
import type { WorkspaceId } from '../../../shared/workspace-types'
import './tabs.css'

// WTB-006/007: Constants for overflow calculation
const MIN_WORKSPACE_WIDTH = 140
const OVERFLOW_BUTTON_WIDTH = 50

interface TabBarProps {
  onCloseTab?: (tabId: string) => void
}

export function TabBar({ onCloseTab }: TabBarProps) {
  const dispatch = useDispatch()
  const tabs = useSelector(selectAllTabs)
  const workspaces = useSelector(selectAllWorkspaces)
  const activeWorkspaceId = useSelector(selectActiveWorkspaceId)

  // WTB-007: Ref and state for overflow detection
  const tabBarRef = useRef<HTMLDivElement>(null)
  const [maxVisibleWorkspaces, setMaxVisibleWorkspaces] = useState(Infinity)

  // WTB-007: Calculate how many workspaces can fit
  const calculateMaxVisible = useCallback(() => {
    if (!tabBarRef.current) return
    const tabBarWidth = tabBarRef.current.clientWidth
    const availableWidth = tabBarWidth - OVERFLOW_BUTTON_WIDTH
    const max = Math.floor(availableWidth / MIN_WORKSPACE_WIDTH)
    setMaxVisibleWorkspaces(Math.max(1, max))
  }, [])

  useEffect(() => {
    calculateMaxVisible()
    const observer = new ResizeObserver(calculateMaxVisible)
    if (tabBarRef.current) {
      observer.observe(tabBarRef.current)
    }
    return () => observer.disconnect()
  }, [calculateMaxVisible])

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

  // Get workspaces that are visible in tab bar and have tabs
  // WTB-001: Filter by visibleInTabBar state
  const workspacesWithTabs = useMemo(() => {
    return workspaces.filter((ws) => {
      const wsTabs = tabsByWorkspace.get(ws.id)
      // WTB-001: Use !== false to treat undefined as visible (defensive)
      return ws.visibleInTabBar !== false && wsTabs && wsTabs.length > 0
    })
  }, [workspaces, tabsByWorkspace])

  // WTB-007: Split workspaces into visible and overflow
  // Active workspace must always be visible
  const { visibleWorkspaces, overflowWorkspaces } = useMemo(() => {
    if (workspacesWithTabs.length <= maxVisibleWorkspaces) {
      return { visibleWorkspaces: workspacesWithTabs, overflowWorkspaces: [] }
    }

    // Ensure active workspace is in visible set
    const activeWs = workspacesWithTabs.find((ws) => ws.id === activeWorkspaceId)
    const others = workspacesWithTabs.filter((ws) => ws.id !== activeWorkspaceId)

    // Fill remaining slots with most recently used (order in array)
    const visibleSlots = maxVisibleWorkspaces - (activeWs ? 1 : 0)
    const visibleOthers = others.slice(0, visibleSlots)
    const overflowOthers = others.slice(visibleSlots)

    return {
      visibleWorkspaces: activeWs
        ? [activeWs, ...visibleOthers]
        : visibleOthers,
      overflowWorkspaces: overflowOthers
    }
  }, [workspacesWithTabs, maxVisibleWorkspaces, activeWorkspaceId])

  // WTB-007: Tab count for overflow dropdown
  const tabCountByWorkspace = useMemo(() => {
    const counts = new Map<string, number>()
    tabsByWorkspace.forEach((wsTabs, wsId) => {
      counts.set(wsId, wsTabs.length)
    })
    return counts
  }, [tabsByWorkspace])

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
    <div className="tab-bar" ref={tabBarRef}>
      {visibleWorkspaces.map((workspace) => {
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
      <TabBarOverflow
        overflowWorkspaces={overflowWorkspaces}
        tabCountByWorkspace={tabCountByWorkspace}
      />
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
  // WTB-009: Each workspace independently tracks its own active tab
  // The active indicator shows on the active tab of EVERY visible workspace
  const activeTabId = useSelector((state: RootState) =>
    selectActiveTabIdByWorkspace(state, workspaceId)
  )

  return (
    <TabGroup
      workspaceId={workspaceId}
      workspaceName={workspaceName}
      workspaceColor={workspaceColor}
      tabs={tabs}
      activeTabId={activeTabId}
      onTabClick={onTabClick}
      onTabClose={onTabClose}
    />
  )
}
