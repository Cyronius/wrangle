import { useRef, useState, useCallback, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { AppDispatch, RootState } from '../../store/store'
import {
  selectAllWorkspaces,
  selectActiveWorkspaceId,
  addWorkspace,
  expandWorkspaceExclusive,
  setActiveWorkspace,
  reorderWorkspaces,
  setVisibleInTabBar
} from '../../store/workspacesSlice'
import { setWorkspaceSidebar, setFocusedPane } from '../../store/layoutSlice'
import { WorkspaceState } from '../../../../shared/workspace-types'
import { useEdgeScroll } from '../../hooks/useEdgeScroll'
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
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './workspace.css'

interface WorkspaceBarItemProps {
  workspace: WorkspaceState
  isActive: boolean
  onClick: () => void
  isVisible: boolean
}

function SortableWorkspaceBarItem({ workspace, isActive, onClick, isVisible }: WorkspaceBarItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: workspace.id })

  const style = {
    backgroundColor: workspace.color,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined
  }

  return (
    <div
      ref={setNodeRef}
      className={`workspace-bar-item ${isActive ? 'active' : ''} ${isVisible ? '' : 'not-in-editor'}`}
      style={style}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Workspace: ${workspace.name}. Press Enter to browse its files.`}
      aria-expanded={workspace.isExpanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      {...attributes}
      {...listeners}
    >
      <span className="workspace-bar-name">{workspace.name}</span>
    </div>
  )
}

export function WorkspaceBar() {
  const dispatch = useDispatch<AppDispatch>()
  const workspaces = useSelector(selectAllWorkspaces)
  const activeWorkspaceId = useSelector(selectActiveWorkspaceId)
  const focusedPaneId = useSelector((s: RootState) => s.layout.focusedPaneId)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef<HTMLDivElement>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)
  useEdgeScroll(itemsRef)

  const checkScroll = useCallback(() => {
    const el = itemsRef.current
    if (!el) return
    setCanScrollUp(el.scrollTop > 0)
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1)
  }, [])

  useEffect(() => {
    checkScroll()
  }, [workspaces.length, checkScroll])

  useEffect(() => {
    const el = itemsRef.current
    if (!el) return
    el.addEventListener('scroll', checkScroll)
    // Also check on resize
    const observer = new ResizeObserver(checkScroll)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      observer.disconnect()
    }
  }, [checkScroll])

  const scrollAnimRef = useRef<number | null>(null)

  const stopScroll = useCallback(() => {
    if (scrollAnimRef.current) {
      cancelAnimationFrame(scrollAnimRef.current)
      scrollAnimRef.current = null
    }
  }, [])

  const startScroll = useCallback((direction: number) => {
    stopScroll()
    const animate = () => {
      const el = itemsRef.current
      if (el) {
        el.scrollTop += direction * 6
      }
      scrollAnimRef.current = requestAnimationFrame(animate)
    }
    scrollAnimRef.current = requestAnimationFrame(animate)
  }, [stopScroll])

  // Clean up animation on unmount or when buttons disappear
  useEffect(() => {
    if (!canScrollUp && !canScrollDown) {
      stopScroll()
    }
  }, [canScrollUp, canScrollDown, stopScroll])

  const handleWorkspaceClick = (workspace: WorkspaceState) => {
    // WTB-001 / WTB-013: Clicking the already-active workspace toggles it: if it
    // is currently in the editor, hide it (last-visible guard applies); otherwise
    // re-show it. Clicking any other workspace browses it and shows it as a pane.
    if (workspace.id === activeWorkspaceId && workspace.visibleInTabBar) {
      handleHideWorkspace(workspace)
      return
    }
    dispatch(setVisibleInTabBar({ id: workspace.id, visible: true }))
    dispatch(setActiveWorkspace(workspace.id))
    dispatch(expandWorkspaceExclusive(workspace.id))
    dispatch(setWorkspaceSidebar(true))
    dispatch(setFocusedPane(workspace.id))
  }

  const handleHideWorkspace = (workspace: WorkspaceState) => {
    // WTB-013: Hide the workspace from the editor (remove its pane) while leaving
    // it open and browsable. No-op when it is the only visible workspace, so the
    // editor is never left with zero panes.
    if (!workspace.visibleInTabBar) return
    const otherVisible = workspaces.filter(
      (w) => w.id !== workspace.id && w.visibleInTabBar
    )
    if (otherVisible.length === 0) return

    dispatch(setVisibleInTabBar({ id: workspace.id, visible: false }))

    // If the hidden workspace held editor focus, fall back to another visible
    // pane. activeWorkspace/expanded are deliberately left unchanged so the user
    // keeps browsing the just-hidden workspace's file tree.
    if (workspace.id === focusedPaneId) {
      dispatch(setFocusedPane(otherVisible[0].id))
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = workspaces.findIndex(w => w.id === active.id)
    const newIndex = workspaces.findIndex(w => w.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      dispatch(reorderWorkspaces({ oldIndex, newIndex }))
    }
  }

  const handleAddWorkspace = async () => {
    // Get colors of existing workspaces to avoid duplicates
    const usedColors = workspaces.map((w) => w.color)

    // Open folder dialog
    const result = await window.electron.workspace.openFolder(usedColors)
    if (!result) return

    // Add to Redux store
    dispatch(
      addWorkspace({
        id: result.config.id,
        name: result.config.name,
        color: result.config.color,
        rootPath: result.path,
        isExpanded: true,
        showHiddenFiles: result.config.showHiddenFiles !== false,
        visibleInTabBar: true // WTB-001: New workspaces are visible by default
      })
    )

    // Switch to the new workspace and expand it exclusively
    dispatch(setActiveWorkspace(result.config.id))
    dispatch(expandWorkspaceExclusive(result.config.id))
    dispatch(setFocusedPane(result.config.id))
    dispatch(setWorkspaceSidebar(true))
  }

  return (
    <div className="workspace-bar" ref={containerRef}>
      <div
        className="workspace-bar-add"
        onClick={handleAddWorkspace}
        role="button"
        tabIndex={0}
        aria-label="Add workspace"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleAddWorkspace()
          }
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      {canScrollUp && (
        <button
          className="workspace-bar-scroll-btn"
          onMouseEnter={() => startScroll(-1)}
          onMouseLeave={stopScroll}
          aria-label="Scroll up"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      )}
      <div className="workspace-bar-items" ref={itemsRef}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={workspaces.map(w => w.id)}
            strategy={verticalListSortingStrategy}
          >
            {workspaces.map((workspace) => (
              <SortableWorkspaceBarItem
                key={workspace.id}
                workspace={workspace}
                isActive={workspace.id === activeWorkspaceId}
                isVisible={workspace.visibleInTabBar}
                onClick={() => handleWorkspaceClick(workspace)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      {canScrollDown && (
        <button
          className="workspace-bar-scroll-btn"
          onMouseEnter={() => startScroll(1)}
          onMouseLeave={stopScroll}
          aria-label="Scroll down"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    </div>
  )
}
