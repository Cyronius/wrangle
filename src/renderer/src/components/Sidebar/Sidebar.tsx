import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Allotment } from 'allotment'
import { RootState, AppDispatch } from '../../store/store'
import { setViewMode, toggleOutline, toggleToolbar, toggleExplorer } from '../../store/layoutSlice'
import { setCurrentTheme, saveThemeSettings, setSidebarPaneSizes, saveLayoutSettings } from '../../store/settingsSlice'
import {
  selectAllWorkspaces,
  selectActiveWorkspace,
  updateWorkspace,
  removeWorkspace,
  collapseAllWorkspaces
} from '../../store/workspacesSlice'
import { selectActiveTab, selectAllTabs } from '../../store/tabsSlice'
import { DEFAULT_WORKSPACE_ID, WORKSPACE_COLORS } from '../../../../shared/workspace-types'
import { FileTree } from '../Workspace/FileTree'
import { DefaultWorkspaceFileList } from '../Workspace/DefaultWorkspaceFileList'
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
  const activeWorkspace = useSelector(selectActiveWorkspace)

  // Set of file paths currently open in tabs (for bolding in explorer)
  const openPaths = useMemo(
    () => new Set(allTabs.filter(t => t.path).map(t => t.path!)),
    [allTabs]
  )

  // Menu state
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // Section collapse state
  const [explorerCollapsed, setExplorerCollapsed] = useState(false)
  const [outlineCollapsed, setOutlineCollapsed] = useState(false)

  // Workspace name editing state
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Workspace color picker state
  const [showColorPicker, setShowColorPicker] = useState(false)
  const colorPickerRef = useRef<HTMLDivElement>(null)

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

  // Close color picker when clicking outside
  useEffect(() => {
    if (!showColorPicker) return
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColorPicker])

  // Handle workspace color change
  const handleColorChange = useCallback((color: string) => {
    if (!activeWorkspace) return
    dispatch(updateWorkspace({ id: activeWorkspace.id, changes: { color } }))
    setShowColorPicker(false)
    if (activeWorkspace.rootPath) {
      window.electron.workspace.loadConfig(activeWorkspace.rootPath).then((config) => {
        if (config) {
          window.electron.workspace.saveConfig(activeWorkspace.rootPath!, { ...config, color })
        }
      })
    }
  }, [dispatch, activeWorkspace])

  // Handle close workspace
  const handleCloseWorkspace = useCallback(() => {
    if (!activeWorkspace || activeWorkspace.id === DEFAULT_WORKSPACE_ID) return
    const shouldClose = window.confirm(`Close workspace "${activeWorkspace.name}"?`)
    if (!shouldClose) return
    dispatch(removeWorkspace(activeWorkspace.id))
    if (activeWorkspace.rootPath) {
      window.electron.workspace.unwatchFolder(activeWorkspace.rootPath)
    }
    dispatch(collapseAllWorkspaces())
  }, [dispatch, activeWorkspace])

  // Handle hidden files toggle
  const handleToggleHiddenFiles = useCallback(() => {
    if (!activeWorkspace) return
    const newValue = !activeWorkspace.showHiddenFiles
    dispatch(updateWorkspace({ id: activeWorkspace.id, changes: { showHiddenFiles: newValue } }))
    if (activeWorkspace.rootPath) {
      window.electron.workspace.loadConfig(activeWorkspace.rootPath).then((config) => {
        if (config) {
          window.electron.workspace.saveConfig(activeWorkspace.rootPath!, {
            ...config,
            showHiddenFiles: newValue
          })
        }
      })
    }
  }, [dispatch, activeWorkspace])

  // Handle workspace name rename
  const handleStartRename = useCallback(() => {
    if (!activeWorkspace) return
    setEditNameValue(activeWorkspace.name)
    setEditingName(true)
    // Focus after React renders the input
    setTimeout(() => nameInputRef.current?.select(), 0)
  }, [activeWorkspace])

  const handleCommitRename = useCallback(() => {
    if (!activeWorkspace || !activeWorkspace.rootPath) return
    setEditingName(false)
    const trimmed = editNameValue.trim()
    // If empty, revert to folder basename
    const newName = trimmed || activeWorkspace.rootPath.split(/[/\\]/).filter(Boolean).pop() || 'Workspace'
    if (newName === activeWorkspace.name) return
    dispatch(updateWorkspace({ id: activeWorkspace.id, changes: { name: newName } }))
    window.electron.workspace.loadConfig(activeWorkspace.rootPath).then((config) => {
      if (config) {
        window.electron.workspace.saveConfig(activeWorkspace.rootPath!, {
          ...config,
          name: newName
        })
      }
    })
  }, [dispatch, activeWorkspace, editNameValue])

  const handleCancelRename = useCallback(() => {
    setEditingName(false)
  }, [])

  // Handle Allotment pane size change (debounced persist)
  // Skip saving when any section is collapsed to avoid persisting bad sizes (e.g. [28])
  const handlePaneSizeChange = useCallback((sizes: number[]) => {
    if (explorerCollapsed || outlineCollapsed) return
    if (paneSaveTimeout.current) clearTimeout(paneSaveTimeout.current)
    paneSaveTimeout.current = setTimeout(() => {
      dispatch(setSidebarPaneSizes(sizes))
      dispatch(saveLayoutSettings({ ...layoutSettings, sidebarPaneSizes: sizes }))
    }, 300)
  }, [dispatch, layoutSettings, explorerCollapsed, outlineCollapsed])

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
                          <span className="menu-check">{subItem.checked ? '\u2713' : ''}</span>
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
                <span className="menu-check">{item.checked ? '\u2713' : ''}</span>
              )}
              <span>{item.label}</span>
              {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
            </button>
          )
        })}
      </div>
    )
  }

  const nonDefaultWorkspaces = workspaces.filter(w => w.id !== DEFAULT_WORKSPACE_ID)
  const hasWorkspace = activeWorkspace && activeWorkspace.id !== DEFAULT_WORKSPACE_ID && activeWorkspace.rootPath
  const hasPanels = showExplorer || showOutline

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

      {/* Workspace indicator */}
      {hasWorkspace && (
        <div className="sidebar-workspace-indicator">
          <div className="sidebar-color-picker" ref={colorPickerRef}>
            <div
              className="sidebar-workspace-color"
              style={{ backgroundColor: activeWorkspace.color }}
              onClick={() => setShowColorPicker(!showColorPicker)}
              role="button"
              aria-label="Change workspace color"
              tabIndex={0}
            />
            {showColorPicker && (
              <div className="sidebar-color-dropdown">
                {WORKSPACE_COLORS.map((color) => (
                  <div
                    key={color}
                    className={`sidebar-color-option ${color === activeWorkspace.color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                    role="button"
                    tabIndex={0}
                  />
                ))}
                <div className="sidebar-color-custom">
                  <input
                    type="color"
                    value={activeWorkspace.color}
                    onChange={(e) => handleColorChange(e.target.value)}
                    title="Pick a custom color"
                    className="sidebar-color-input"
                  />
                  <span className="sidebar-color-custom-label">Custom</span>
                </div>
              </div>
            )}
          </div>
          {editingName ? (
            <input
              ref={nameInputRef}
              className="sidebar-workspace-name-input"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitRename()
                if (e.key === 'Escape') handleCancelRename()
              }}
              onBlur={handleCommitRename}
            />
          ) : (
            <span
              className="sidebar-workspace-name"
              onClick={handleStartRename}
              title="Click to rename workspace"
            >
              {activeWorkspace.name}
            </span>
          )}
          <button
            className="sidebar-workspace-close"
            onClick={handleCloseWorkspace}
            title="Close workspace"
            aria-label="Close workspace"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Resizable panels (Explorer + Outline) */}
      {hasPanels && (
        <div className="sidebar-panels">
          <Allotment
            key={`panels-${explorerCollapsed}-${outlineCollapsed}`}
            vertical
            onChange={handlePaneSizeChange}
            defaultSizes={(!explorerCollapsed && !outlineCollapsed && sidebarPaneSizes?.every(s => s >= 50)) ? sidebarPaneSizes : undefined}
          >
            {showExplorer && (
              <Allotment.Pane
                minSize={28}
                maxSize={explorerCollapsed ? 28 : undefined}
              >
                <div className="sidebar-section sidebar-section-allotment">
                  <button
                    className="sidebar-section-header sidebar-section-toggle"
                    onClick={() => setExplorerCollapsed(!explorerCollapsed)}
                  >
                    <svg className={`sidebar-section-chevron ${explorerCollapsed ? '' : 'expanded'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span className="sidebar-section-title">Explorer</span>
                  </button>
                  {!explorerCollapsed && (
                    <div className="sidebar-section-content">
                      {hasWorkspace ? (
                        <>
                          <label className="sidebar-hidden-files-toggle">
                            <input
                              type="checkbox"
                              checked={activeWorkspace.showHiddenFiles}
                              onChange={handleToggleHiddenFiles}
                            />
                            Show hidden files
                          </label>
                          <FileTree
                            rootPath={activeWorkspace.rootPath!}
                            workspaceId={activeWorkspace.id}
                            onFileOpen={onFileOpenFromTree}
                            selectedPath={activeTab?.path}
                            showHiddenFiles={activeWorkspace.showHiddenFiles}
                            openPaths={openPaths}
                          />
                        </>
                      ) : activeWorkspace?.id === DEFAULT_WORKSPACE_ID ? (
                        <DefaultWorkspaceFileList />
                      ) : nonDefaultWorkspaces.length === 0 ? (
                        <div className="sidebar-section-empty">
                          <button className="sidebar-add-folder-btn" onClick={onAddWorkspace}>
                            Open Folder
                          </button>
                        </div>
                      ) : (
                        <div className="sidebar-section-empty">
                          Select a workspace above
                        </div>
                      )}
                    </div>
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
    </div>
  )
}
