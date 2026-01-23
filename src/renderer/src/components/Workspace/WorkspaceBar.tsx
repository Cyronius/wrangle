import { useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../../store/store'
import {
  selectAllWorkspaces,
  selectActiveWorkspaceId,
  addWorkspace,
  expandWorkspaceExclusive,
  setActiveWorkspace,
  reorderWorkspaces
} from '../../store/workspacesSlice'
import { setWorkspaceSidebar, setFocusedPane, addVisiblePane } from '../../store/layoutSlice'
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
}

function SortableWorkspaceBarItem({ workspace, isActive, onClick }: WorkspaceBarItemProps) {
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
      className={`workspace-bar-item ${isActive ? 'active' : ''}`}
      style={style}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Workspace: ${workspace.name}. Press Enter to expand.`}
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
  const showWorkspaceSidebar = useSelector((state: RootState) => state.layout.showWorkspaceSidebar)
  const multiPaneEnabled = useSelector((state: RootState) => state.layout.multiPaneEnabled)
  const visiblePanes = useSelector((state: RootState) => state.layout.visiblePanes)
  const containerRef = useRef<HTMLDivElement>(null)
  useEdgeScroll(containerRef)

  const handleWorkspaceClick = (workspace: WorkspaceState) => {
    if (multiPaneEnabled) {
      // In multi-pane mode: focus existing pane or add as new pane
      if (visiblePanes.includes(workspace.id)) {
        dispatch(setFocusedPane(workspace.id))
        dispatch(setActiveWorkspace(workspace.id))
      } else {
        dispatch(addVisiblePane(workspace.id))
        dispatch(setActiveWorkspace(workspace.id))
      }
    } else {
      // Single-pane mode: toggle sidebar
      if (workspace.isExpanded && showWorkspaceSidebar) {
        dispatch(setWorkspaceSidebar(false))
      } else {
        dispatch(setActiveWorkspace(workspace.id))
        dispatch(expandWorkspaceExclusive(workspace.id))
        dispatch(setWorkspaceSidebar(true))
      }
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
        isExpanded: true
      })
    )

    // Switch to the new workspace and expand it exclusively
    dispatch(setActiveWorkspace(result.config.id))
    dispatch(expandWorkspaceExclusive(result.config.id))

    if (multiPaneEnabled) {
      // Add as new pane in multi-pane mode
      dispatch(addVisiblePane(result.config.id))
    } else {
      // Show sidebar for new workspace in single-pane mode
      dispatch(setWorkspaceSidebar(true))
    }
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
              onClick={() => handleWorkspaceClick(workspace)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  )
}
