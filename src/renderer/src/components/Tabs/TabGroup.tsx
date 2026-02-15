import { useEffect, useRef, useCallback, useState } from 'react'
import { useDispatch } from 'react-redux'

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
  onTabContextMenu?: (e: React.MouseEvent, tabId: string) => void
}

interface SortableTabProps {
  tab: TabDocument
  isActive: boolean
  onTabClick: () => void
  onTabClose: (e: React.MouseEvent) => void
  onTabContextMenu?: (e: React.MouseEvent) => void
}

function SortableTab({ tab, isActive, onTabClick, onTabClose, onTabContextMenu }: SortableTabProps) {
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
    <div
      ref={combinedRef}
      style={style}
      className="sortable-tab-wrapper"
      {...attributes}
      {...listeners}
      onContextMenu={onTabContextMenu}
    >
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
  onTabClose,
  onTabContextMenu
}: TabGroupProps) {
  const dispatch = useDispatch()
  const scrollableRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

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

  // WTB-010: Check scroll overflow to show/hide arrow buttons
  const checkScroll = useCallback(() => {
    const el = scrollableRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = scrollableRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll)
    const observer = new ResizeObserver(checkScroll)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      observer.disconnect()
    }
  }, [checkScroll])

  // Recheck when tabs are added/removed
  useEffect(() => {
    checkScroll()
  }, [tabs.length, checkScroll])

  const handleScrollLeft = useCallback(() => {
    scrollableRef.current?.scrollBy({ left: -200, behavior: 'smooth' })
  }, [])

  const handleScrollRight = useCallback(() => {
    scrollableRef.current?.scrollBy({ left: 200, behavior: 'smooth' })
  }, [])

  // Don't render empty groups
  if (tabs.length === 0) {
    return null
  }

  const groupStyle: React.CSSProperties = {
    '--workspace-color': workspaceColor
  } as React.CSSProperties

  return (
    <div
      className="tab-group"
      style={groupStyle}
      data-workspace-id={workspaceId}
    >
      {/* WTB-003/004: Scrollable wrapper - tabs scroll independently per workspace */}
      <div className="tab-group-scrollable" ref={scrollableRef}>
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
                  onTabContextMenu={onTabContextMenu ? (e) => onTabContextMenu(e, tab.id) : undefined}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
      {/* WTB-010: Scroll arrow buttons replace native scrollbar */}
      {canScrollLeft && (
        <button
          className="tab-group-scroll-btn tab-group-scroll-left"
          onClick={handleScrollLeft}
          aria-label="Scroll tabs left"
        >
          ‹
        </button>
      )}
      {canScrollRight && (
        <button
          className="tab-group-scroll-btn tab-group-scroll-right"
          onClick={handleScrollRight}
          aria-label="Scroll tabs right"
        >
          ›
        </button>
      )}
    </div>
  )
}
