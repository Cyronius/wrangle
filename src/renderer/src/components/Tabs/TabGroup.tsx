import { useState, useEffect, useRef, useCallback } from 'react'
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
  widthPercent?: number
}

interface SortableTabProps {
  tab: TabDocument
  isActive: boolean
  workspaceColor: string // WTB-005: Pass workspace color to Tab
  onTabClick: () => void
  onTabClose: (e: React.MouseEvent) => void
}

function SortableTab({ tab, isActive, workspaceColor, onTabClick, onTabClose }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: tab.id })

  const elementRef = useRef<HTMLDivElement | null>(null)

  // WTB-008: Auto-scroll to active tab when it becomes active
  useEffect(() => {
    if (isActive && elementRef.current) {
      elementRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'nearest',
        block: 'nearest'
      })
    }
  }, [isActive])

  // Combine refs: dnd-kit's setNodeRef + our elementRef for scrolling
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    setNodeRef(node)
    elementRef.current = node
  }, [setNodeRef])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined
  }

  return (
    <div ref={combinedRef} style={style} className="sortable-tab-wrapper" {...attributes} {...listeners}>
      <Tab
        id={tab.id}
        filename={tab.displayTitle || tab.filename}
        isDirty={tab.isDirty}
        isActive={isActive}
        workspaceColor={workspaceColor}
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
  onTabClose,
  widthPercent
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

  const groupStyle: React.CSSProperties = {
    '--workspace-color': workspaceColor,
    ...(widthPercent != null ? { flex: `0 0 ${widthPercent}%` } : {})
  } as React.CSSProperties

  return (
    <div
      className={`tab-group ${isCollapsed ? 'collapsed' : ''}`}
      style={groupStyle}
      data-workspace-id={workspaceId}
    >
      {/* WTB-004: Header stays fixed (outside scrollable area) */}
      <TabGroupHeader
        color={workspaceColor}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      {!isCollapsed && (
        /* WTB-003/004: Scrollable wrapper - tabs scroll independently per workspace */
        <div className="tab-group-scrollable">
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
                    workspaceColor={workspaceColor}
                    onTabClick={() => onTabClick(tab.id)}
                    onTabClose={(e) => onTabClose(e, tab.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  )
}
