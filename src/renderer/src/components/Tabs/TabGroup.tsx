import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { TabGroupHeader } from './TabGroupHeader'
import { Tab } from './Tab'
import type { TabDocument } from '../../store/tabsSlice'
import { reorderTabs } from '../../store/tabsSlice'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface TabGroupProps {
  workspaceId: string
  workspaceName: string
  workspaceColor: string
  tabs: TabDocument[]
  activeTabId: string | null
  onTabClick: (tabId: string) => void
  onTabClose: (e: React.MouseEvent, tabId: string) => void
}

interface SortableTabProps {
  tab: TabDocument
  isActive: boolean
  onTabClick: () => void
  onTabClose: (e: React.MouseEvent) => void
}

function SortableTab({ tab, isActive, onTabClick, onTabClose }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: tab.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined
  }

  return (
    <div ref={setNodeRef} style={style} className="sortable-tab-wrapper" {...attributes} {...listeners}>
      <Tab
        id={tab.id}
        filename={tab.displayTitle || tab.filename}
        isDirty={tab.isDirty}
        isActive={isActive}
        onClick={onTabClick}
        onClose={onTabClose}
        title={tab.path || tab.filename}
      />
    </div>
  )
}

export function TabGroup({
  workspaceId,
  workspaceColor,
  tabs,
  activeTabId,
  onTabClick,
  onTabClose
}: TabGroupProps) {
  const dispatch = useDispatch()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tabs.findIndex(t => t.id === active.id)
    const newIndex = tabs.findIndex(t => t.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      dispatch(reorderTabs({ workspaceId, oldIndex, newIndex }))
    }
  }

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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tabs.map(t => t.id)}
              strategy={horizontalListSortingStrategy}
            >
              {tabs.map((tab) => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onTabClick={() => onTabClick(tab.id)}
                  onTabClose={(e) => onTabClose(e, tab.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  )
}
