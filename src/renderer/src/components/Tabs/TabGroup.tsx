import { useState } from 'react'
import { TabGroupHeader } from './TabGroupHeader'
import { Tab } from './Tab'
import type { TabDocument } from '../../store/tabsSlice'

interface TabGroupProps {
  workspaceId: string
  workspaceName: string
  workspaceColor: string
  tabs: TabDocument[]
  activeTabId: string | null
  onTabClick: (tabId: string) => void
  onTabClose: (e: React.MouseEvent, tabId: string) => void
}

export function TabGroup({
  workspaceId,
  workspaceName,
  workspaceColor,
  tabs,
  activeTabId,
  onTabClick,
  onTabClose
}: TabGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  // Don't render empty groups
  if (tabs.length === 0) {
    return null
  }

  return (
    <div
      className={`tab-group ${isCollapsed ? 'collapsed' : ''}`}
      style={{ '--workspace-color': workspaceColor } as React.CSSProperties}
      data-workspace-id={workspaceId}
    >
      <TabGroupHeader
        color={workspaceColor}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      {!isCollapsed && (
        <div className="tab-group-tabs">
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              id={tab.id}
              filename={tab.displayTitle || tab.filename}
              isDirty={tab.isDirty}
              isActive={tab.id === activeTabId}
              onClick={() => onTabClick(tab.id)}
              onClose={(e) => onTabClose(e, tab.id)}
              title={tab.path || tab.filename}
            />
          ))}
        </div>
      )}
    </div>
  )
}
