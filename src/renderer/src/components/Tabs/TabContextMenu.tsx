import { useEffect, useRef, useState, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { selectAllTabs, closeTabsToLeft, closeTabsToRight, closeTabsByWorkspace } from '../../store/tabsSlice'
import { selectAllWorkspaces } from '../../store/workspacesSlice'

interface TabContextMenuProps {
  tabId: string
  position: { x: number; y: number }
  onClose: () => void
}

export function TabContextMenu({ tabId, position, onClose }: TabContextMenuProps) {
  const dispatch = useDispatch()
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPos, setAdjustedPos] = useState(position)

  const tabs = useSelector(selectAllTabs)
  const workspaces = useSelector(selectAllWorkspaces)

  const tab = tabs.find(t => t.id === tabId)
  const workspace = tab ? workspaces.find(w => w.id === tab.workspaceId) : null
  const workspaceTabs = tab ? tabs.filter(t => t.workspaceId === tab.workspaceId) : []
  const tabIndex = workspaceTabs.findIndex(t => t.id === tabId)

  const hasPath = !!tab?.path
  const isFirst = tabIndex === 0
  const isLast = tabIndex === workspaceTabs.length - 1

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const adjusted = { ...position }
    if (rect.right > window.innerWidth) {
      adjusted.x = window.innerWidth - rect.width - 4
    }
    if (rect.bottom > window.innerHeight) {
      adjusted.y = window.innerHeight - rect.height - 4
    }
    setAdjustedPos(adjusted)
  }, [position])

  // Close on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleRevealInExplorer = useCallback(() => {
    if (tab?.path) {
      window.electron.shell.showItemInFolder(tab.path)
    }
    onClose()
  }, [tab, onClose])

  const handleCopyPath = useCallback(() => {
    if (tab?.path) {
      navigator.clipboard.writeText(tab.path)
    }
    onClose()
  }, [tab, onClose])

  const handleCopyRelativePath = useCallback(() => {
    if (!tab?.path) { onClose(); return }
    if (workspace?.rootPath) {
      const normalized = tab.path.replace(/\\/g, '/')
      const normalizedRoot = workspace.rootPath.replace(/\\/g, '/')
      const prefix = normalizedRoot.endsWith('/') ? normalizedRoot : normalizedRoot + '/'
      const relative = normalized.startsWith(prefix)
        ? normalized.slice(prefix.length)
        : tab.path
      navigator.clipboard.writeText(relative)
    } else {
      navigator.clipboard.writeText(tab.filename)
    }
    onClose()
  }, [tab, workspace, onClose])

  const handleCloseToLeft = useCallback(() => {
    if (isFirst) { onClose(); return }
    const tabsToClose = workspaceTabs.slice(0, tabIndex)
    const hasDirty = tabsToClose.some(t => t.isDirty)
    if (hasDirty) {
      const shouldClose = window.confirm('Some tabs have unsaved changes. Close them anyway?')
      if (!shouldClose) { onClose(); return }
    }
    dispatch(closeTabsToLeft(tabId))
    onClose()
  }, [dispatch, tabId, tabIndex, isFirst, workspaceTabs, onClose])

  const handleCloseToRight = useCallback(() => {
    if (isLast) { onClose(); return }
    const tabsToClose = workspaceTabs.slice(tabIndex + 1)
    const hasDirty = tabsToClose.some(t => t.isDirty)
    if (hasDirty) {
      const shouldClose = window.confirm('Some tabs have unsaved changes. Close them anyway?')
      if (!shouldClose) { onClose(); return }
    }
    dispatch(closeTabsToRight(tabId))
    onClose()
  }, [dispatch, tabId, tabIndex, isLast, workspaceTabs, onClose])

  const handleCloseAll = useCallback(() => {
    if (!tab) { onClose(); return }
    const hasDirty = workspaceTabs.some(t => t.isDirty)
    if (hasDirty) {
      const shouldClose = window.confirm('Some tabs have unsaved changes. Close them anyway?')
      if (!shouldClose) { onClose(); return }
    }
    dispatch(closeTabsByWorkspace(tab.workspaceId))
    onClose()
  }, [dispatch, tab, workspaceTabs, onClose])

  if (!tab) return null

  return (
    <div
      ref={menuRef}
      className="tab-context-menu"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      role="menu"
    >
      <button
        className={`tab-context-menu-item ${!hasPath ? 'disabled' : ''}`}
        onClick={handleRevealInExplorer}
        disabled={!hasPath}
        role="menuitem"
      >
        Reveal in File Explorer
      </button>
      <button
        className={`tab-context-menu-item ${!hasPath ? 'disabled' : ''}`}
        onClick={handleCopyPath}
        disabled={!hasPath}
        role="menuitem"
      >
        Copy Path
      </button>
      <button
        className={`tab-context-menu-item ${!hasPath ? 'disabled' : ''}`}
        onClick={handleCopyRelativePath}
        disabled={!hasPath}
        role="menuitem"
      >
        Copy Relative Path
      </button>
      <div className="tab-context-menu-separator" />
      <button
        className={`tab-context-menu-item ${isFirst ? 'disabled' : ''}`}
        onClick={handleCloseToLeft}
        disabled={isFirst}
        role="menuitem"
      >
        Close Tabs to Left
      </button>
      <button
        className={`tab-context-menu-item ${isLast ? 'disabled' : ''}`}
        onClick={handleCloseToRight}
        disabled={isLast}
        role="menuitem"
      >
        Close Tabs to Right
      </button>
      <button
        className="tab-context-menu-item"
        onClick={handleCloseAll}
        role="menuitem"
      >
        Close All Tabs
      </button>
    </div>
  )
}
