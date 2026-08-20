import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Allotment } from 'allotment'
import { RootState, AppDispatch } from '../../store/store'
import { setViewMode, toggleOutline, toggleToolbar, toggleExplorer } from '../../store/layoutSlice'
import { setCurrentTheme, saveThemeSettings, setSidebarPaneSizes, saveLayoutSettings } from '../../store/settingsSlice'
import { selectAllWorkspaces } from '../../store/workspacesSlice'
import { selectActiveTab, selectAllTabs } from '../../store/tabsSlice'
import { DEFAULT_WORKSPACE_ID } from '../../../../shared/workspace-types'
import { WorkspaceSection } from './WorkspaceSection'
import { OpenFilesSection } from './OpenFilesSection'
import { WorkspaceSettingsPopover } from './WorkspaceSettingsPopover'
import { marked } from 'marked'
import { builtInThemes } from '../../styles/themes'
import wrangleIcon from '../../../../assets/wrangle.png'
import * as monaco from 'monaco-editor'
import './Sidebar.css'

interface MenuItem {
  label: string
  shortcut?: string
  action?: () => void
  separator?: boolean
  submenu?: MenuItem[]
  checked?: boolean
}

interface SidebarProps {
  onFileNew: () => void
  onFileOpen: () => void
  onFileSave: () => void
  onFileSaveAs: () => void
  onCloseTab?: () => void
  onEditUndo?: () => void
  onEditRedo?: () => void
  onCopyRichText?: () => void
  onExportHtml?: () => void
  onExportPdf?: () => void
  onOpenPreferences?: () => void
  onAddWorkspace?: () => void
  onFileOpenFromTree: (filePath: string) => void
  content: string
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>
}

// Outline section content
interface OutlineItem {
  id: string
  level: number
  text: string
  lineNumber: number
}

const OutlineContent = memo(function OutlineContent({ content, editorRef }: {
  content: string
  editorRef: React.RefObject<monaco.editor.IStandaloneCodeEditor | null>
}) {
  const [items, setItems] = useState<OutlineItem[]>([])
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      const tokens = marked.lexer(content)
      const parsed: OutlineItem[] = []
      let currentOffset = 0
      let currentLine = 1

      tokens.forEach((token) => {
        if ('raw' in token) {
          const tokenStart = content.indexOf(token.raw, currentOffset)
          for (let i = currentOffset; i < tokenStart; i++) {
            if (content[i] === '\n') currentLine++
          }
          if (token.type === 'heading') {
            parsed.push({
              id: `heading-${currentLine}`,
              level: token.depth,
              text: token.text,
              lineNumber: currentLine
            })
          }
          for (let i = tokenStart; i < tokenStart + token.raw.length; i++) {
            if (content[i] === '\n') currentLine++
          }
          currentOffset = tokenStart + token.raw.length
        }
      })

      setItems(parsed)
    }, 1000)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [content])

  const handleClick = (item: OutlineItem) => {
    if (!editorRef.current) return
    editorRef.current.revealLineInCenter(item.lineNumber)
    editorRef.current.setPosition({ lineNumber: item.lineNumber, column: 1 })
    editorRef.current.focus()
  }

  if (items.length === 0) {
    return <div className="sidebar-section-empty">No headings found</div>
  }

  return (
    <div className="sidebar-outline-items">
      {items.map(item => (
        <button
          key={item.id}
          className={`outline-item outline-level-${item.level}`}
          onClick={() => handleClick(item)}
          title={`Go to line ${item.lineNumber}`}
        >
          {item.text}
        </button>
      ))}
    </div>
  )
})

export function Sidebar({
  onFileNew, onFileOpen, onFileSave, onFileSaveAs, onCloseTab,
  onEditUndo, onEditRedo, onCopyRichText, onExportHtml, onExportPdf,
  onOpenPreferences, onAddWorkspace, onFileOpenFromTree, content, editorRef
}: SidebarProps) {
  const dispatch = useDispatch<AppDispatch>()
  const workspaces = useSelector(selectAllWorkspaces)
  const showOutline = useSelector((state: RootState) => state.layout.showOutline)
  const showToolbar = useSelector((state: RootState) => state.layout.showToolbar)
  const showExplorer = useSelector((state: RootState) => state.layout.showExplorer)
  const viewMode = useSelector((state: RootState) => state.layout.viewMode)
  const currentTheme = useSelector((state: RootState) => state.settings.theme.current)
  const customThemes = useSelector((state: RootState) => state.settings.theme.customThemes)
  const layoutSettings = useSelector((state: RootState) => state.settings.layout)
  const sidebarPaneSizes = layoutSettings.sidebarPaneSizes
  const activeTab = useSelector(selectActiveTab)
  const allTabs = useSelector(selectAllTabs)

  // Set of file paths currently open in tabs (for bolding in explorer)
  const openPaths = useMemo(
    () => new Set(allTabs.filter(t => t.path).map(t => t.path!)),
    [allTabs]
  )

  const folderWorkspaces = useMemo(
    () => workspaces.filter(w => w.rootPath),
    [workspaces]
  )
  const hasLooseFiles = useMemo(
    () => allTabs.some(t => t.workspaceId === DEFAULT_WORKSPACE_ID),
    [allTabs]
  )

  // Menu state
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Outline section collapse state
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)

  // SBR-005: one settings popover open at a time
  const [openSettings, setOpenSettings] = useState<{
    workspaceId: string
    anchorRect: DOMRect
  } | null>(null)

  // Debounce ref for pane size persistence
  const paneSaveTimeout = useRef<NodeJS.Timeout | null>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
        setOpenSubmenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMenuClick = (menuName: string) => {
    setOpenMenu(openMenu === menuName ? null : menuName)
    setOpenSubmenu(null)
  }

  // Drag the window when the user mouses down on a blank drag region.
  // We need this in JS because `app-region: drag` is unreliable in this app
  // (Allotment's absolute-positioned panes interfere with Chromium's drag
  // hit-test). screenX/screenY stay valid even when the cursor leaves the
  // window mid-drag.
  const handleDragRegionMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const bounds = await window.electron.window.getBounds()
    if (!bounds) return
    const startMouseX = e.screenX
    const startMouseY = e.screenY
    const startWinX = bounds.x
    const startWinY = bounds.y

    let pendingX = startWinX
    let pendingY = startWinY
    let rafId: number | null = null

    const flush = () => {
      rafId = null
      window.electron.window.setPosition(pendingX, pendingY)
    }

    const onMove = (moveEvent: MouseEvent) => {
      pendingX = startWinX + (moveEvent.screenX - startMouseX)
      pendingY = startWinY + (moveEvent.screenY - startMouseY)
      if (rafId === null) rafId = requestAnimationFrame(flush)
    }
    const onUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      flush()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const handleMenuItemClick = (action?: () => void) => {
    if (action) action()
    setOpenMenu(null)
    setOpenSubmenu(null)
  }

  const handleOpenSettings = useCallback((workspaceId: string, anchorRect: DOMRect) => {
    setOpenSettings((current) =>
      current?.workspaceId === workspaceId ? null : { workspaceId, anchorRect }
    )
  }, [])

  // Handle Allotment pane size change (debounced persist)
  // Skip saving while the outline is collapsed to avoid persisting bad sizes (e.g. [28])
  const handlePaneSizeChange = useCallback((sizes: number[]) => {
    if (outlineCollapsed) return
    if (paneSaveTimeout.current) clearTimeout(paneSaveTimeout.current)
    paneSaveTimeout.current = setTimeout(() => {
      dispatch(setSidebarPaneSizes(sizes))
      dispatch(saveLayoutSettings({ ...layoutSettings, sidebarPaneSizes: sizes }))
    }, 300)
  }, [dispatch, layoutSettings, outlineCollapsed])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (paneSaveTimeout.current) clearTimeout(paneSaveTimeout.current)
    }
  }, [])

  // Menu definitions
  const menus: Record<string, MenuItem[]> = {
    Wrangle: [
      { label: 'New', shortcut: 'Ctrl+N', action: onFileNew },
      { label: 'Open', shortcut: 'Ctrl+O', action: onFileOpen },
      { label: 'Save', shortcut: 'Ctrl+S', action: onFileSave },
      { label: 'Save As', shortcut: 'Ctrl+Shift+S', action: onFileSaveAs },
      { label: 'Close Tab', shortcut: 'Ctrl+W', action: onCloseTab },
      { separator: true, label: '' },
      { label: 'Export as HTML', action: onExportHtml },
      { label: 'Export as PDF', action: onExportPdf },
      { separator: true, label: '' },
      { label: 'Print', shortcut: 'Ctrl+P', action: () => window.electron.window.print() },
      { separator: true, label: '' },
      { label: 'Preferences', shortcut: 'Ctrl+,', action: onOpenPreferences },
      { separator: true, label: '' },
      { label: 'Exit', shortcut: 'Ctrl+Q', action: () => window.electron.window.close() }
    ],
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: onEditUndo },
      { label: 'Redo', shortcut: 'Ctrl+Y', action: onEditRedo },
      { separator: true, label: '' },
      { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
      { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
      { label: 'Copy as Rich Text', action: onCopyRichText },
      { label: 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
      { separator: true, label: '' },
      { label: 'Select All', shortcut: 'Ctrl+A', action: () => document.execCommand('selectAll') },
      { separator: true, label: '' },
      { label: 'Toggle Case', shortcut: 'Ctrl+Shift+U' }
    ],
    View: [
      { label: 'Editor Only', shortcut: 'Ctrl+1', checked: viewMode === 'editor-only', action: () => dispatch(setViewMode('editor-only')) },
      { label: 'Split View', shortcut: 'Ctrl+2', checked: viewMode === 'split', action: () => dispatch(setViewMode('split')) },
      { label: 'Preview Only', shortcut: 'Ctrl+3', checked: viewMode === 'preview-only', action: () => dispatch(setViewMode('preview-only')) },
      { separator: true, label: '' },
      { label: 'Show Toolbar', shortcut: 'Ctrl+Shift+T', checked: showToolbar, action: () => dispatch(toggleToolbar()) },
      { label: 'Show Explorer', shortcut: 'Ctrl+Shift+E', checked: showExplorer, action: () => dispatch(toggleExplorer()) },
      { label: 'Show Outline', shortcut: 'Ctrl+Shift+O', checked: showOutline, action: () => dispatch(toggleOutline()) },
      { separator: true, label: '' },
      {
        label: 'Theme',
        submenu: [...Object.keys(builtInThemes), ...Object.keys(customThemes)].map(name => ({
          label: name,
          checked: currentTheme === name,
          action: () => { dispatch(setCurrentTheme(name)); dispatch(saveThemeSettings()) }
        }))
      },
      { separator: true, label: '' },
      { label: 'Reset Zoom', shortcut: 'Ctrl+0', action: () => window.electron.window.resetZoom() },
      { label: 'Zoom In', shortcut: 'Ctrl++', action: () => window.electron.window.zoom(1) },
      { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => window.electron.window.zoom(-1) },
      { separator: true, label: '' },
      { label: 'Toggle Developer Tools', shortcut: 'F12', action: () => window.electron.window.toggleDevTools() }
    ]
  }

  // Get dropdown position for a menu button (opens to the right)
  const getDropdownPosition = (menuName: string): React.CSSProperties => {
    const btn = menuButtonRefs.current[menuName]
    if (!btn) return { top: 0, left: 0 }
    const rect = btn.getBoundingClientRect()
    return {
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      zIndex: 1000
    }
  }

  const renderMenuDropdown = (menuName: string, items: MenuItem[]) => {
    if (openMenu !== menuName) return null
    const hasCheckedItems = items.some(item => item.checked !== undefined)

    return (
      <div className="sidebar-menu-dropdown" style={getDropdownPosition(menuName)}>
        {items.map((item, index) => {
          if (item.separator) {
            return <div key={index} className="menu-dropdown-separator" />
          }
          if (item.submenu) {
            const hasCheckedSub = item.submenu.some(s => s.checked !== undefined)
            return (
              <div
                key={index}
                className="menu-dropdown-item menu-submenu"
                onMouseEnter={() => setOpenSubmenu(item.label)}
                onMouseLeave={() => setOpenSubmenu(null)}
              >
                {hasCheckedItems && <span className="menu-check" />}
                <span>{item.label}</span>
                <span className="menu-submenu-indicator">&#9654;</span>
                {openSubmenu === item.label && (
                  <div className="menu-submenu-dropdown">
                    {item.submenu.map((subItem, subIndex) => (
                      <button
                        key={subIndex}
                        className="menu-dropdown-item"
                        onClick={() => handleMenuItemClick(subItem.action)}
                      >
                        {hasCheckedSub && (
                          <span className="menu-check">{subItem.checked ? '✓' : ''}</span>
                        )}
                        <span>{subItem.label}</span>
                        {subItem.shortcut && <span className="shortcut">{subItem.shortcut}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          }
          return (
            <button
              key={index}
              className="menu-dropdown-item"
              onClick={() => handleMenuItemClick(item.action)}
            >
              {hasCheckedItems && (
                <span className="menu-check">{item.checked ? '✓' : ''}</span>
              )}
              <span>{item.label}</span>
              {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
            </button>
          )
        })}
      </div>
    )
  }

  const hasPanels = showExplorer || showOutline
  const settingsWorkspace = openSettings
    ? workspaces.find(w => w.id === openSettings.workspaceId)
    : undefined

  return (
    <div className="sidebar">
      {/* Menus row */}
      <div className="sidebar-top">
        <div className="sidebar-menus" ref={menuRef}>
          {Object.entries(menus).map(([menuName, items], index) => (
            <div key={menuName} className={`sidebar-menu-item ${openMenu === menuName ? 'open' : ''}`}>
              <button
                ref={(el) => { menuButtonRefs.current[menuName] = el }}
                className="sidebar-menu-btn"
                onClick={() => handleMenuClick(menuName)}
                onMouseEnter={() => openMenu && setOpenMenu(menuName)}
              >
                {index === 0 ? (
                  <img src={wrangleIcon} alt="Wrangle" className="sidebar-menu-icon" />
                ) : (
                  menuName
                )}
              </button>
              {renderMenuDropdown(menuName, items)}
            </div>
          ))}
        </div>
        <div className="sidebar-top-drag-spacer" onMouseDown={handleDragRegionMouseDown} />
      </div>

      {/* Resizable panels: workspace sections column + Outline (SBR-001) */}
      {hasPanels && (
        <div className="sidebar-panels">
          <Allotment
            key={`panels-${outlineCollapsed}`}
            vertical
            onChange={handlePaneSizeChange}
            defaultSizes={(!outlineCollapsed && sidebarPaneSizes?.every(s => s >= 50)) ? sidebarPaneSizes : undefined}
          >
            {showExplorer && (
              <Allotment.Pane minSize={60}>
                <div className="sidebar-workspace-column">
                  {hasLooseFiles && <OpenFilesSection />}
                  {folderWorkspaces.map((workspace) => (
                    <WorkspaceSection
                      key={workspace.id}
                      workspace={workspace}
                      onFileOpen={onFileOpenFromTree}
                      selectedPath={activeTab?.path}
                      openPaths={openPaths}
                      onOpenSettings={handleOpenSettings}
                    />
                  ))}
                  {folderWorkspaces.length === 0 && !hasLooseFiles ? (
                    <div className="sidebar-section-empty">
                      <button className="sidebar-add-folder-btn" onClick={onAddWorkspace}>
                        Open Folder
                      </button>
                    </div>
                  ) : (
                    <button className="sidebar-add-folder-row" onClick={onAddWorkspace}>
                      + Add Folder
                    </button>
                  )}
                </div>
              </Allotment.Pane>
            )}
            {showOutline && (
              <Allotment.Pane
                minSize={28}
                maxSize={outlineCollapsed ? 28 : undefined}
              >
                <div className="sidebar-section sidebar-section-allotment">
                  <button
                    className="sidebar-section-header sidebar-section-toggle"
                    onClick={() => setOutlineCollapsed(!outlineCollapsed)}
                  >
                    <svg className={`sidebar-section-chevron ${outlineCollapsed ? '' : 'expanded'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span className="sidebar-section-title">Outline</span>
                  </button>
                  {!outlineCollapsed && (
                    <div className="sidebar-section-content">
                      <OutlineContent content={content} editorRef={editorRef} />
                    </div>
                  )}
                </div>
              </Allotment.Pane>
            )}
          </Allotment>
        </div>
      )}

      {/* SBR-005: workspace settings popover (one at a time) */}
      {openSettings && settingsWorkspace && (
        <WorkspaceSettingsPopover
          workspace={settingsWorkspace}
          anchorRect={openSettings.anchorRect}
          onClose={() => setOpenSettings(null)}
        />
      )}
    </div>
  )
}
