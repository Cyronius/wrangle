import { useEffect, useState, useCallback } from 'react'
import { useSelector, useDispatch, Provider } from 'react-redux'
import { store, RootState, AppDispatch } from './store/store'
import { setViewMode, zoomIn, zoomOut, resetZoom, toggleOutline, setWorkspaceSidebar, toggleMultiPane, setFocusedPane, addVisiblePane } from './store/layoutSlice'
import {
  addTab,
  updateTab,
  setActiveTab,
  closeTab,
  nextTab,
  previousTab,
  selectAllTabs,
  markSessionRestored
} from './store/tabsSlice'
import { selectActiveWorkspaceId, selectAllWorkspaces, addWorkspace, setActiveWorkspace } from './store/workspacesSlice'
import { loadSettings, setCurrentTheme } from './store/settingsSlice'
import { DEFAULT_WORKSPACE_ID } from '../../shared/workspace-types'
import { EditorLayout } from './components/Layout/EditorLayout'
import { TabBar } from './components/Tabs/TabBar'
import { MarkdownToolbar } from './components/UI/MarkdownToolbar'
import { TitleBar } from './components/TitleBar/TitleBar'
import { ThemeProvider } from './components/ThemeProvider'
import { OutlineSidebar } from './components/Outline/OutlineSidebar'
import { PreferencesDialog } from './components/Preferences/PreferencesDialog'
import { EmptyState } from './components/EmptyState'
import { WorkspaceBar } from './components/Workspace/WorkspaceBar'
import { WorkspaceSidebar } from './components/Workspace/WorkspaceSidebar'
import { MultiPaneContainer } from './components/Layout/MultiPaneContainer'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { CommandDefinition } from './commands/registry'
import { useImageDrop } from './hooks/useImageDrop'
import { useEditorPane } from './hooks/useEditorPane'
import { useSessionPersistence } from './hooks/useSessionPersistence'
import { useWindowDrag } from './hooks/useWindowDrag'

// Module-level flag to prevent double session restore in React Strict Mode
let sessionRestoreStarted = false

function AppContent() {
  const dispatch = useDispatch<AppDispatch>()

  // Redux state
  const tabs = useSelector(selectAllTabs)
  const activeWorkspaceId = useSelector(selectActiveWorkspaceId)
  const theme = useSelector((state: RootState) => state.settings.theme.current)
  const showOutline = useSelector((state: RootState) => state.layout.showOutline)
  const showWorkspaceSidebar = useSelector((state: RootState) => state.layout.showWorkspaceSidebar)
  const multiPaneEnabled = useSelector((state: RootState) => state.layout.multiPaneEnabled)
  const focusedPaneId = useSelector((state: RootState) => state.layout.focusedPaneId)
  const workspaces = useSelector(selectAllWorkspaces)
  const expandedWorkspace = workspaces.find((w) => w.isExpanded)

  // Editor pane hook - manages content, cursor/scroll tracking, auto-save
  const {
    editorRef,
    content,
    baseDir,
    currentFilePath,
    activeTab,
    handleChange,
    handleCursorPositionChange,
    handleScrollTopChange
  } = useEditorPane(activeWorkspaceId)


  // Preferences dialog state
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Alt+drag window movement
  const showDragOverlay = useWindowDrag()

  // Load settings on mount
  useEffect(() => {
    dispatch(loadSettings())
  }, [dispatch])

  // Restore session on app startup
  useEffect(() => {
    if (sessionRestoreStarted) return
    sessionRestoreStarted = true

    const restoreSession = async () => {
      try {
        // Restore default workspace tabs
        const defaultSession = await window.electron.workspace.loadDefaultSession()
        if (defaultSession && defaultSession.tabs.length > 0) {
          for (const tabState of defaultSession.tabs) {
            let content = tabState.content || ''

            // For saved files, read the current content from disk
            if (tabState.path) {
              const fileData = await window.electron.file.readByPath(tabState.path)
              if (fileData) {
                content = fileData.content
              } else {
                // File no longer exists, skip this tab
                continue
              }
            }

            dispatch(addTab({
              id: tabState.id,
              workspaceId: DEFAULT_WORKSPACE_ID,
              filename: tabState.filename,
              content,
              path: tabState.path,
              isDirty: tabState.isDirty && !tabState.path,
              displayTitle: tabState.displayTitle,
              cursorPosition: tabState.cursorPosition,
              scrollTop: tabState.scrollPosition
            }))
          }

          if (defaultSession.activeTabId) {
            dispatch(setActiveTab(defaultSession.activeTabId))
          }
        }

        // Restore workspace sessions
        const appSession = await window.electron.workspace.loadAppSession()
        if (appSession && appSession.openWorkspaces.length > 0) {
          for (const workspacePath of appSession.openWorkspaces) {
            // Load workspace config
            const config = await window.electron.workspace.loadConfig(workspacePath)
            if (!config) continue

            // Add workspace to store
            dispatch(addWorkspace({
              id: config.id,
              name: config.name,
              color: config.color,
              rootPath: workspacePath,
              isExpanded: false
            }))

            // Load workspace session (tabs)
            const session = await window.electron.workspace.loadSession(workspacePath)
            if (session && session.tabs.length > 0) {
              for (const tabState of session.tabs) {
                let content = tabState.content || ''

                if (tabState.path) {
                  const fileData = await window.electron.file.readByPath(tabState.path)
                  if (fileData) {
                    content = fileData.content
                  } else {
                    continue
                  }
                }

                dispatch(addTab({
                  id: tabState.id,
                  workspaceId: config.id,
                  filename: tabState.filename,
                  content,
                  path: tabState.path,
                  isDirty: tabState.isDirty && !tabState.path,
                  displayTitle: tabState.displayTitle,
                  cursorPosition: tabState.cursorPosition,
                  scrollTop: tabState.scrollPosition
                }))
              }

              if (session.activeTabId) {
                dispatch(setActiveTab(session.activeTabId))
              }
            }
          }

          // Restore active workspace
          if (appSession.activeWorkspacePath) {
            const activeConfig = await window.electron.workspace.loadConfig(appSession.activeWorkspacePath)
            if (activeConfig) {
              dispatch(setActiveWorkspace(activeConfig.id))
            }
          }

          // Restore multi-pane mode
          if (appSession.multiPaneEnabled && appSession.visiblePaneWorkspacePaths) {
            for (const panePath of appSession.visiblePaneWorkspacePaths) {
              const paneConfig = await window.electron.workspace.loadConfig(panePath)
              if (paneConfig) {
                dispatch(addVisiblePane(paneConfig.id))
              }
            }
            // Set focused pane
            if (appSession.focusedPaneWorkspacePath) {
              const focusedConfig = await window.electron.workspace.loadConfig(appSession.focusedPaneWorkspacePath)
              if (focusedConfig) {
                dispatch(setFocusedPane(focusedConfig.id))
              }
            }
            // Enable multi-pane (visiblePanes already populated)
            const paneIds = store.getState().layout.visiblePanes
            if (paneIds.length > 0) {
              dispatch(toggleMultiPane(paneIds))
            }
          }
        }
        // After session restore, check for crash recovery
        try {
          const crashInfo = await window.electron.crashRecovery.check()
          if (crashInfo.didCrash && crashInfo.orphanedDrafts.length > 0) {
            // Get currently restored tab IDs to avoid duplicates
            const currentTabs = store.getState().tabs.tabs
            const openTabIds = new Set(currentTabs.map((t: { id: string }) => t.id))

            let firstRecoveredId: string | null = null
            for (const draft of crashInfo.orphanedDrafts) {
              if (openTabIds.has(draft.tabId)) continue

              // Extract title from first H1 heading or first non-empty line
              const h1Match = draft.content.match(/^#\s+(.+)$/m)
              const firstLine = draft.content.split('\n').find((l: string) => l.trim())
              const displayTitle = h1Match
                ? h1Match[1].trim()
                : firstLine?.replace(/^#+\s*/, '').substring(0, 50) || undefined

              dispatch(addTab({
                id: draft.tabId,
                workspaceId: DEFAULT_WORKSPACE_ID,
                filename: displayTitle || 'Recovered',
                content: draft.content,
                isDirty: true,
                displayTitle
              }))

              if (!firstRecoveredId) firstRecoveredId = draft.tabId
            }

            if (firstRecoveredId) {
              dispatch(setActiveTab(firstRecoveredId))
            }
          }
        } catch (error) {
          console.error('Crash recovery check failed:', error)
        }
      } catch (error) {
        console.error('Failed to restore session:', error)
      }
      dispatch(markSessionRestored())
    }

    restoreSession()
  }, [dispatch])

  // Auto-save session state (guarded until session restore completes)
  useSessionPersistence()


  // Ctrl+Scroll wheel zoom - use capture phase to intercept before Monaco
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        e.stopPropagation()
        // deltaY > 0 means scrolling down (zoom out), < 0 means scrolling up (zoom in)
        dispatch(e.deltaY > 0 ? zoomOut() : zoomIn())
      }
    }
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', handleWheel, { capture: true })
  }, [dispatch])

  // Get viewMode for auto-focus decision
  const viewMode = useSelector((state: RootState) => state.layout.viewMode)

  // File operations
  const handleNewFile = useCallback(() => {
    const newTabId = `tab-${Date.now()}`
    dispatch(addTab({
      id: newTabId,
      workspaceId: activeWorkspaceId,
      filename: 'Untitled',
      content: '',
      isDirty: false
    }))
    dispatch(setActiveTab(newTabId))

    // Auto-focus editor for new documents (in editor or split view)
    if (viewMode !== 'preview-only') {
      requestAnimationFrame(() => {
        editorRef.current?.focus()
      })
    }
  }, [dispatch, viewMode, activeWorkspaceId])

  // Close tab handler
  const handleCloseTab = useCallback(async () => {
    if (!activeTab) return

    // Close tab and cleanup temp files if unsaved
    if (!activeTab.path) {
      await window.electron.file.cleanupTemp(activeTab.id)
    }
    dispatch(closeTab(activeTab.id))
  }, [activeTab, dispatch])

  // Detect workspace for a file path
  const detectWorkspaceForPath = useCallback((filePath: string) => {
    // Check non-default workspaces first (they have rootPath)
    const normalizedFilePath = filePath.replace(/\\/g, '/')
    for (const workspace of workspaces) {
      if (workspace.rootPath) {
        const normalizedRootPath = workspace.rootPath.replace(/\\/g, '/')
        if (normalizedFilePath.startsWith(normalizedRootPath + '/')) {
          return workspace.id
        }
      }
    }
    return activeWorkspaceId
  }, [workspaces, activeWorkspaceId])

  const handleOpen = useCallback(async () => {
    const fileData = await window.electron.file.open()
    if (fileData) {
      // Check if file is already open
      const existingTab = tabs.find(t => t.path === fileData.path)
      if (existingTab) {
        dispatch(setActiveTab(existingTab.id))
        return
      }

      // Detect workspace based on file path
      const workspaceId = detectWorkspaceForPath(fileData.path)

      // Create new tab
      const filename = fileData.path.split(/[\\/]/).pop() || 'Untitled'
      const newTabId = `tab-${Date.now()}`
      dispatch(addTab({
        id: newTabId,
        workspaceId,
        filename,
        content: fileData.content,
        path: fileData.path,
        isDirty: false
      }))
      dispatch(setActiveTab(newTabId))
    }
  }, [tabs, dispatch, detectWorkspaceForPath])

  // Handle opening a file from the workspace file tree
  const handleFileOpenFromTree = useCallback(async (filePath: string) => {
    // Check if file is already open
    const existingTab = tabs.find(t => t.path === filePath)
    if (existingTab) {
      dispatch(setActiveTab(existingTab.id))
      return
    }

    try {
      // Read the file content
      const fileData = await window.electron.file.readByPath(filePath)
      if (!fileData) return

      // Use the expanded workspace's ID for the file
      const workspaceId = expandedWorkspace?.id || activeWorkspaceId

      // Create new tab
      const filename = filePath.split(/[\\/]/).pop() || 'Untitled'
      const newTabId = `tab-${Date.now()}`
      dispatch(addTab({
        id: newTabId,
        workspaceId,
        filename,
        content: fileData.content,
        path: filePath,
        isDirty: false
      }))
      dispatch(setActiveTab(newTabId))
    } catch (error) {
      console.error('Failed to open file:', error)
    }
  }, [tabs, dispatch, expandedWorkspace, activeWorkspaceId])

  // Handle adding a new workspace from folder
  const handleAddWorkspace = useCallback(async () => {
    const usedColors = workspaces.map((w) => w.color)
    const result = await window.electron.workspace.openFolder(usedColors)
    if (!result) return

    dispatch(
      addWorkspace({
        id: result.config.id,
        name: result.config.name,
        color: result.config.color,
        rootPath: result.path,
        isExpanded: true
      })
    )
    dispatch(setWorkspaceSidebar(true))
  }, [workspaces, dispatch])

  const handleSaveAs = useCallback(async () => {
    if (!activeTab) return

    const wasUnsaved = !activeTab.path

    // Extract first H1 heading for suggested filename
    const h1Match = content.match(/^#\s+(.+)$/m)
    const suggestedName = h1Match
      ? h1Match[1].trim().replace(/[^a-zA-Z0-9-_ ]/g, '').substring(0, 50)
      : undefined

    const filePath = await window.electron.file.saveAs(content, suggestedName)
    if (filePath) {
      // If this was previously an unsaved file, move temp files to saved location
      if (wasUnsaved) {
        await window.electron.file.moveTempFiles(activeTab.id, filePath)
      }

      const filename = filePath.split(/[\\/]/).pop() || 'Untitled'
      dispatch(updateTab({
        id: activeTab.id,
        filename,
        content,
        path: filePath,
        isDirty: false
      }))
    }
  }, [activeTab, content, dispatch])

  const handleSave = useCallback(async () => {
    if (!activeTab) return

    if (activeTab.path) {
      // Save to existing path
      const success = await window.electron.file.save(activeTab.path, content)
      if (success) {
        dispatch(updateTab({
          id: activeTab.id,
          content,
          isDirty: false
        }))
      }
    } else {
      // No path, do save as
      await handleSaveAs()
    }
  }, [activeTab, content, dispatch, handleSaveAs])

  // Global keyboard shortcuts (capture phase to fire before Monaco)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+1: Editor only (must be before Monaco intercepts)
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault()
        e.stopPropagation()
        dispatch(setViewMode('editor-only'))
        return
      }
      // Ctrl+2: Split view
      if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault()
        e.stopPropagation()
        dispatch(setViewMode('split'))
        return
      }
      // Ctrl+3: Preview only
      if ((e.ctrlKey || e.metaKey) && e.key === '3') {
        e.preventDefault()
        e.stopPropagation()
        dispatch(setViewMode('preview-only'))
        return
      }
      // Ctrl+N: New file
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        handleNewFile()
      }
      // Ctrl+O: Open file
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        handleOpen()
      }
      // Ctrl+S: Save file
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        handleSave()
      }
      // Ctrl+Shift+S: Save As
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && e.shiftKey) {
        e.preventDefault()
        handleSaveAs()
      }
      // Ctrl+W: Close current tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault()
        handleCloseTab()
      }
      // Ctrl+Shift+P: Command Palette
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }
      // Ctrl+Shift+PageDown: Next pane (multi-pane) or next workspace (single-pane)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'PageDown') {
        e.preventDefault()
        if (multiPaneEnabled) {
          const visiblePanes = store.getState().layout.visiblePanes
          const currentIndex = visiblePanes.indexOf(focusedPaneId || '')
          const nextIndex = (currentIndex + 1) % visiblePanes.length
          if (visiblePanes[nextIndex]) {
            dispatch(setFocusedPane(visiblePanes[nextIndex]))
            dispatch(setActiveWorkspace(visiblePanes[nextIndex]))
          }
        } else if (workspaces.length > 1) {
          const currentIndex = workspaces.findIndex(w => w.id === activeWorkspaceId)
          const nextIndex = (currentIndex + 1) % workspaces.length
          dispatch(setActiveWorkspace(workspaces[nextIndex].id))
        }
        return
      }
      // Ctrl+Shift+PageUp: Previous pane (multi-pane) or prev workspace (single-pane)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'PageUp') {
        e.preventDefault()
        if (multiPaneEnabled) {
          const visiblePanes = store.getState().layout.visiblePanes
          const currentIndex = visiblePanes.indexOf(focusedPaneId || '')
          const prevIndex = currentIndex <= 0 ? visiblePanes.length - 1 : currentIndex - 1
          if (visiblePanes[prevIndex]) {
            dispatch(setFocusedPane(visiblePanes[prevIndex]))
            dispatch(setActiveWorkspace(visiblePanes[prevIndex]))
          }
        } else if (workspaces.length > 1) {
          const currentIndex = workspaces.findIndex(w => w.id === activeWorkspaceId)
          const prevIndex = currentIndex <= 0 ? workspaces.length - 1 : currentIndex - 1
          dispatch(setActiveWorkspace(workspaces[prevIndex].id))
        }
        return
      }
      // Ctrl+PageDown: Next tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'PageDown') {
        e.preventDefault()
        dispatch(nextTab(activeWorkspaceId))
      }
      // Ctrl+PageUp: Previous tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'PageUp') {
        e.preventDefault()
        dispatch(previousTab(activeWorkspaceId))
      }
      // Ctrl+0: Reset zoom
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault()
        dispatch(resetZoom())
      }
      // Ctrl+Plus or Ctrl+=: Zoom in
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault()
        dispatch(zoomIn())
      }
      // Ctrl+Minus: Zoom out
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault()
        dispatch(zoomOut())
      }
      // Ctrl+P: Print
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        window.electron.window.print()
      }
      // Ctrl+Z: Undo (when editor not focused, Monaco handles its own)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (!document.activeElement?.closest('.monaco-editor')) {
          e.preventDefault()
          editorRef.current?.trigger('keyboard', 'undo', null)
          editorRef.current?.focus()
        }
      }
      // Ctrl+Y: Redo (when editor not focused)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (!document.activeElement?.closest('.monaco-editor')) {
          e.preventDefault()
          editorRef.current?.trigger('keyboard', 'redo', null)
          editorRef.current?.focus()
        }
      }
      // Ctrl+Shift+O: Toggle outline
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'o') {
        e.preventDefault()
        dispatch(toggleOutline())
      }
      // F12: Toggle DevTools (fallback for when global shortcut fails)
      if (e.key === 'F12') {
        e.preventDefault()
        window.electron.window.toggleDevTools()
      }
      // Ctrl+,: Open preferences
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        setPreferencesOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [handleNewFile, handleCloseTab, handleOpen, handleSave, handleSaveAs, dispatch, activeWorkspaceId, multiPaneEnabled, focusedPaneId])

  // Menu command handler
  useEffect(() => {
    const unsubscribe = window.electron.onMenuCommand((command: string) => {
      switch (command) {
        case 'file:new':
          handleNewFile()
          break
        case 'file:open':
          handleOpen()
          break
        case 'file:save':
          handleSave()
          break
        case 'file:saveAs':
          handleSaveAs()
          break
        case 'view:editor-only':
          dispatch(setViewMode('editor-only'))
          break
        case 'view:split':
          dispatch(setViewMode('split'))
          break
        case 'view:preview-only':
          dispatch(setViewMode('preview-only'))
          break
        case 'theme:light':
          dispatch(setCurrentTheme('light'))
          break
        case 'theme:dark':
          dispatch(setCurrentTheme('dark'))
          break
        case 'workspace:openFolder':
          handleAddWorkspace()
          break
        case 'view:toggle-multi-pane': {
          const workspaceIds = workspaces.map(w => w.id)
          dispatch(toggleMultiPane(workspaceIds))
          break
        }
      }
    })

    return unsubscribe
  }, [activeTab, content, dispatch, handleAddWorkspace])

  // Image drop support
  const { isDragging } = useImageDrop({
    editorRef,
    tabId: activeTab?.id,
    currentFilePath,
    onImageInsert: () => {
      // Mark tab as dirty when image is inserted
      if (activeTab) {
        dispatch(updateTab({
          id: activeTab.id,
          isDirty: true
        }))
      }
    }
  })

  // Undo/Redo handlers for Monaco editor
  const handleUndo = useCallback(() => {
    editorRef.current?.trigger('keyboard', 'undo', null)
    editorRef.current?.focus()
  }, [])

  const handleRedo = useCallback(() => {
    editorRef.current?.trigger('keyboard', 'redo', null)
    editorRef.current?.focus()
  }, [])

  // Copy as Rich Text - copies preview HTML to clipboard
  const handleCopyRichText = useCallback(async () => {
    const previewElement = document.querySelector('.markdown-body')
    if (!previewElement) return

    const html = previewElement.innerHTML
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([previewElement.textContent || ''], { type: 'text/plain' })
        })
      ])
    } catch (error) {
      console.error('Failed to copy rich text:', error)
    }
  }, [])

  // Export as HTML - creates a standalone HTML file
  const handleExportHtml = useCallback(async () => {
    const previewElement = document.querySelector('.markdown-body')
    if (!previewElement) return

    const html = previewElement.innerHTML
    const title = activeTab?.filename?.replace(/\.md$/, '') || 'Document'

    // Create standalone HTML document with embedded styles
    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: .3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: .3em; }
    h3 { font-size: 1.25em; }
    p { margin-top: 0; margin-bottom: 16px; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { padding: .2em .4em; margin: 0; font-size: 85%; background-color: rgba(27,31,35,.05); border-radius: 3px; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; }
    pre { padding: 16px; overflow: auto; font-size: 85%; line-height: 1.45; background-color: #f6f8fa; border-radius: 3px; }
    pre code { padding: 0; background-color: transparent; }
    blockquote { padding: 0 1em; color: #6a737d; border-left: .25em solid #dfe2e5; margin: 0 0 16px 0; }
    ul, ol { padding-left: 2em; margin-top: 0; margin-bottom: 16px; }
    li { margin-top: .25em; }
    table { border-spacing: 0; border-collapse: collapse; margin-bottom: 16px; }
    th, td { padding: 6px 13px; border: 1px solid #dfe2e5; }
    th { font-weight: 600; background-color: #f6f8fa; }
    tr:nth-child(2n) { background-color: #f6f8fa; }
    img { max-width: 100%; height: auto; }
    hr { height: .25em; padding: 0; margin: 24px 0; background-color: #e1e4e8; border: 0; }
  </style>
</head>
<body>
  ${html}
</body>
</html>`

    // Use file save dialog to save as HTML
    await window.electron.file.saveAs(htmlDoc, title)
  }, [activeTab?.filename])

  // Export as PDF
  const handleExportPdf = useCallback(async () => {
    await window.electron.window.exportPdf()
  }, [])

  // Monaco theme based on app theme
  const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark'

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {showDragOverlay && <div className="window-drag-overlay" />}
      <TitleBar
        onFileNew={handleNewFile}
        onFileOpen={handleOpen}
        onFileSave={handleSave}
        onFileSaveAs={handleSaveAs}
        onCloseTab={handleCloseTab}
        onEditUndo={handleUndo}
        onEditRedo={handleRedo}
        onCopyRichText={handleCopyRichText}
        onExportHtml={handleExportHtml}
        onExportPdf={handleExportPdf}
        onOpenPreferences={() => setPreferencesOpen(true)}
      >
        {!multiPaneEnabled && (
          <TabBar
            onCloseTab={async (tabId) => {
              // Clean up temp directory if tab was never saved
              const tabToClose = tabs.find((t) => t.id === tabId)
              if (tabToClose && !tabToClose.path) {
                await window.electron.file.cleanupTemp(tabId)
              }
            }}
          />
        )}
      </TitleBar>
      {tabs.length > 0 && !multiPaneEnabled && <MarkdownToolbar editorRef={editorRef} />}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        {/* Workspace bar - always visible */}
        <WorkspaceBar />

        {/* Workspace sidebar - shown when a workspace is expanded */}
        {showWorkspaceSidebar && expandedWorkspace && (
          <WorkspaceSidebar onFileOpen={handleFileOpenFromTree} />
        )}

        {tabs.length === 0 ? (
          <EmptyState onNewFile={handleNewFile} onOpenFile={handleOpen} />
        ) : multiPaneEnabled ? (
          <>
            {showOutline && (
              <OutlineSidebar content={content} editorRef={editorRef} />
            )}
            <MultiPaneContainer />
          </>
        ) : (
          <>
            {showOutline && (
              <OutlineSidebar content={content} editorRef={editorRef} />
            )}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {isDragging && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(77, 170, 252, 0.1)',
                    border: '2px dashed var(--accent-color)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    color: 'var(--accent-color)',
                    pointerEvents: 'none'
                  }}
                >
                  Drop images here
                </div>
              )}
              <EditorLayout
                content={content}
                onChange={handleChange}
                baseDir={baseDir}
                theme={monacoTheme}
                editorRef={editorRef}
                onCursorPositionChange={handleCursorPositionChange}
                onScrollTopChange={handleScrollTopChange}
              />
            </div>
          </>
        )}
      </div>
      <PreferencesDialog
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
      />
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onExecute={(cmd: CommandDefinition) => {
          cmd.execute({
            editor: editorRef.current,
            dispatch: dispatch as (action: unknown) => void,
            getState: store.getState,
            handlers: {
              onFileNew: handleNewFile,
              onFileOpen: handleOpen,
              onFileSave: handleSave,
              onFileSaveAs: handleSaveAs,
              onCloseTab: handleCloseTab,
              onEditUndo: handleUndo,
              onEditRedo: handleRedo,
              onOpenPreferences: () => setPreferencesOpen(true)
            }
          })
        }}
      />
    </div>
  )
}

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </Provider>
  )
}

export default App
