import { useEffect, useState, useCallback, useMemo, useRef as useReactRef } from 'react'
import { useSelector, useDispatch, Provider } from 'react-redux'
import { store, RootState, AppDispatch } from './store/store'
import { setViewMode, zoomIn, zoomOut } from './store/layoutSlice'
import {
  addTab,
  updateTab,
  setActiveTab,
  closeTab,
  selectAllTabs,
  markSessionRestored,
  moveTabToWorkspace
} from './store/tabsSlice'
import { selectActiveWorkspaceId, selectAllWorkspaces, addWorkspace, setActiveWorkspace, setWorkspaceExpanded, findFolderWorkspaceForPath } from './store/workspacesSlice'
import { loadSettings } from './store/settingsSlice'
import { DEFAULT_WORKSPACE_ID, type WorkspaceId } from '../../shared/workspace-types'
import { Allotment } from 'allotment'
import { EditorLayout } from './components/Layout/EditorLayout'
import { TabBar } from './components/Tabs/TabBar'
import { FloatingToolbar } from './components/UI/FloatingToolbar'
import { floatingToolbarBus } from './components/UI/floating-toolbar-bus'
import { Sidebar } from './components/Sidebar/Sidebar'
import { WindowControls } from './components/UI/WindowControls'
import { ThemeProvider } from './components/ThemeProvider'
import { PreferencesDialog } from './components/Preferences/PreferencesDialog'
import { EmptyState } from './components/EmptyState'
import { CommandPalette } from './components/CommandPalette/CommandPalette'
import { CommandDefinition, commandMap, CommandContext } from './commands/registry'
import { selectModifierBinding, eventMatchesModifier } from './store/settingsSlice'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useImageDrop } from './hooks/useImageDrop'
import { useEditorPane } from './hooks/useEditorPane'
import { useSessionPersistence } from './hooks/useSessionPersistence'
import { useVimMode } from './hooks/useVimMode'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { getMonacoThemeName } from './utils/monaco-theme-generator'
import { isMarkdownFile } from './utils/file-type'

// Module-level flag to prevent double session restore in React Strict Mode
let sessionRestoreStarted = false

function AppContent() {
  const dispatch = useDispatch<AppDispatch>()

  // Redux state
  const tabs = useSelector(selectAllTabs)
  const activeWorkspaceId = useSelector(selectActiveWorkspaceId)
  const theme = useSelector((state: RootState) => state.settings.theme.current)
  const showToolbar = useSelector((state: RootState) => state.layout.showToolbar)
  const workspaces = useSelector(selectAllWorkspaces)

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

  // Preview selection for WYSIWYG editing
  const [previewSelection, setPreviewSelection] = useState<{ start: number; end: number } | null>(null)

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
          // SBR-002: restore per-section collapse state; sessions saved before
          // this field existed default to all-expanded.
          const expandedSet = appSession.expandedWorkspacePaths
            ? new Set(appSession.expandedWorkspacePaths)
            : null

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
              isExpanded: expandedSet ? expandedSet.has(workspacePath) : true,
              showHiddenFiles: config.showHiddenFiles !== false
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
        }

        // SBR-002: restore Open Files section collapse state
        if (appSession && appSession.openFilesExpanded === false) {
          dispatch(setWorkspaceExpanded({ id: DEFAULT_WORKSPACE_ID, expanded: false }))
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

      // WTB-001: Reassign tabs to correct workspaces based on file paths.
      // Tabs may have been saved with wrong workspaceId if they were opened
      // while a different workspace was active (bug in old handleFileOpenFromTree).
      const allTabs = store.getState().tabs.tabs
      const allWorkspaces = store.getState().workspaces.workspaces
      for (const tab of allTabs) {
        if (!tab.path) continue
        const normalizedPath = tab.path.replace(/\\/g, '/')
        for (const ws of allWorkspaces) {
          if (ws.rootPath) {
            const normalizedRoot = ws.rootPath.replace(/\\/g, '/')
            if (normalizedPath.startsWith(normalizedRoot + '/') && ws.id !== tab.workspaceId) {
              dispatch(moveTabToWorkspace({ tabId: tab.id, newWorkspaceId: ws.id }))
              break
            }
          }
        }
      }

      dispatch(markSessionRestored())
    }

    restoreSession()
  }, [dispatch])

  // Auto-save session state (guarded until session restore completes)
  useSessionPersistence()


  // KBD-014: scroll-wheel zoom modifier is configurable via the
  // `view.zoomScroll` binding. Default Ctrl. Use capture phase so it fires
  // before Monaco can swallow it.
  const zoomScrollModifier = useSelector((s: RootState) =>
    selectModifierBinding(s, 'view.zoomScroll')
  )
  useEffect(() => {
    if (!zoomScrollModifier) return
    const handleWheel = (e: WheelEvent) => {
      if (eventMatchesModifier(e, zoomScrollModifier)) {
        e.preventDefault()
        e.stopPropagation()
        // deltaY > 0 means scrolling down (zoom out), < 0 means scrolling up (zoom in)
        dispatch(e.deltaY > 0 ? zoomOut() : zoomIn())
      }
    }
    window.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', handleWheel, { capture: true })
  }, [dispatch, zoomScrollModifier])

  // Window-drag modifier: while held, the Wrangle icon (and any other element
  // gated on `body.drag-modifier-active`) flips from `no-drag` to `drag`.
  const moveWindowModifier = useSelector((s: RootState) =>
    selectModifierBinding(s, 'view.moveWindow')
  )
  useEffect(() => {
    const setActive = (active: boolean) => {
      document.body.classList.toggle('drag-modifier-active', active)
    }
    if (!moveWindowModifier) {
      setActive(false)
      return
    }
    const handleKey = (e: KeyboardEvent) => {
      setActive(eventMatchesModifier(e, moveWindowModifier))
    }
    const handleBlur = () => setActive(false)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKey)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKey)
      window.removeEventListener('blur', handleBlur)
      setActive(false)
    }
  }, [moveWindowModifier])

  // Get viewMode for auto-focus decision
  const viewMode = useSelector((state: RootState) => state.layout.viewMode)

  // Force editor-only mode for non-markdown files
  useEffect(() => {
    if (!isMarkdownFile(activeTab?.path) && viewMode !== 'editor-only') {
      dispatch(setViewMode('editor-only'))
    }
  }, [activeTab?.path, viewMode, dispatch])

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
    const files = await window.electron.file.open()
    if (files.length === 0) return

    let lastTabId: string | null = null
    let lastWorkspaceId: WorkspaceId | null = null

    for (const fileData of files) {
      // Check if file is already open
      const existingTab = tabs.find(t => t.path === fileData.path)
      if (existingTab) {
        lastTabId = existingTab.id
        lastWorkspaceId = existingTab.workspaceId
        continue
      }

      // Detect workspace based on file path
      const workspaceId = detectWorkspaceForPath(fileData.path)

      // Create new tab with unique ID
      const filename = fileData.path.split(/[\\/]/).pop() || 'Untitled'
      const newTabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
      dispatch(addTab({
        id: newTabId,
        workspaceId,
        filename,
        content: fileData.content,
        path: fileData.path,
        isDirty: false
      }))
      lastTabId = newTabId
      lastWorkspaceId = workspaceId
    }

    // Activate the last opened/found tab and its workspace (SBR-004)
    if (lastWorkspaceId) {
      dispatch(setActiveWorkspace(lastWorkspaceId))
    }
    if (lastTabId) {
      dispatch(setActiveTab(lastTabId))
    }
  }, [tabs, dispatch, detectWorkspaceForPath])

  // Handle opening a file from the workspace file tree
  const handleFileOpenFromTree = useCallback(async (filePath: string) => {
    // Check if file is already open
    const existingTab = tabs.find(t => t.path === filePath)
    if (existingTab) {
      dispatch(setActiveWorkspace(existingTab.workspaceId))
      dispatch(setActiveTab(existingTab.id))
      return
    }

    try {
      // Read the file content
      const fileData = await window.electron.file.readByPath(filePath)
      if (!fileData) return

      // WTB-001: Use path-based detection to ensure tab goes to correct workspace
      // This ensures tabs are properly associated even if another workspace is expanded
      const workspaceId = detectWorkspaceForPath(filePath)

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
      dispatch(setActiveWorkspace(workspaceId))
      dispatch(setActiveTab(newTabId))
    } catch (error) {
      console.error('Failed to open file:', error)
    }
  }, [tabs, dispatch, detectWorkspaceForPath])

  // Handle adding a new workspace from folder (called from native menu)
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
        isExpanded: true,
        showHiddenFiles: result.config.showHiddenFiles !== false
      })
    )
    dispatch(setActiveWorkspace(result.config.id))
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

  // Content area ref for floating toolbar bounds clamping
  const contentAreaRef = useReactRef<HTMLDivElement>(null)


  // Vim mode integration
  const vimStatusBarRef = useReactRef<HTMLDivElement>(null)
  useVimMode({
    editorRef,
    statusBarRef: vimStatusBarRef,
    activeTabId: activeTab?.id ?? null,
    handlers: {
      onSave: handleSave,
      onCloseTab: handleCloseTab,
      onOpen: handleOpen
    }
  })

  // KBD-014: tap-modifier opens the markdown format toolbar at the caret.
  // The modifier is configurable via the `markdown.openFormatToolbar`
  // binding (default Alt). Press + release within 500ms with no intervening
  // key, mouse, or focus event.
  const tapModifier = useSelector((s: RootState) =>
    selectModifierBinding(s, 'markdown.openFormatToolbar')
  )
  useEffect(() => {
    if (!tapModifier) return
    const TAP_MAX_MS = 500
    const targetKey = tapModifier === 'Ctrl' ? 'Control' : tapModifier
    let downAt = 0
    let candidate = false

    const isModifierEventOnly = (e: KeyboardEvent) => {
      const otherFlags = [
        e.ctrlKey && tapModifier !== 'Ctrl',
        e.shiftKey && tapModifier !== 'Shift',
        e.altKey && tapModifier !== 'Alt',
        e.metaKey && tapModifier !== 'Meta'
      ]
      return !otherFlags.some(Boolean)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === targetKey && isModifierEventOnly(e)) {
        if (!candidate) {
          downAt = Date.now()
          candidate = true
        }
        return
      }
      if (candidate) candidate = false
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== targetKey) return
      const wasCandidate = candidate
      const elapsed = Date.now() - downAt
      candidate = false
      if (wasCandidate && elapsed <= TAP_MAX_MS) {
        e.preventDefault()
        floatingToolbarBus.openAtCursor()
      }
    }
    const onMouseDown = () => { candidate = false }
    const onBlur = () => { candidate = false }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [tapModifier])

  // Image and markdown file drop support
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
    },
    workspaces,
    activeWorkspaceId,
    tabs,
    onTextFilesOpen: (files) => {
      let lastTabId: string | null = null

      for (const fileData of files) {
        // Check if file is already open
        const existingTab = tabs.find(t => t.path === fileData.path)
        if (existingTab) {
          lastTabId = existingTab.id
          continue
        }

        // Create new tab with the file content
        const filename = fileData.path.split(/[\\/]/).pop() || 'Untitled'
        const newTabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
        dispatch(addTab({
          id: newTabId,
          workspaceId: fileData.workspaceId,
          filename,
          content: fileData.content,
          path: fileData.path,
          isDirty: false
        }))
        lastTabId = newTabId
      }

      // Activate the last opened/found tab
      if (lastTabId) {
        dispatch(setActiveTab(lastTabId))
      }
    }
  })

  // Handle files opened via the OS (double-click / "Open with" → file:openFromPath).
  // FIO-010: such files land in the default workspace, UNLESS an open folder-backed
  // workspace contains the file (its rootPath is an ancestor), in which case they
  // land there. The target workspace is surfaced, the tab activated, and the editor
  // focused so the user can start typing immediately.
  useEffect(() => {
    const unsubscribe = window.electron.onFileOpenedFromPath((fileData) => {
      const existingTab = tabs.find(t => t.path === fileData.path)

      let targetTabId: string
      let targetWorkspaceId: WorkspaceId

      if (existingTab) {
        // Already open: surface its existing tab, don't duplicate
        targetTabId = existingTab.id
        targetWorkspaceId = existingTab.workspaceId
      } else {
        const folderWorkspace = findFolderWorkspaceForPath(workspaces, fileData.path)
        targetWorkspaceId = folderWorkspace ? folderWorkspace.id : DEFAULT_WORKSPACE_ID

        const filename = fileData.path.split(/[\\/]/).pop() || 'Untitled'
        targetTabId = `tab-${Date.now()}`
        dispatch(addTab({
          id: targetTabId,
          workspaceId: targetWorkspaceId,
          filename,
          content: fileData.content,
          path: fileData.path,
          isDirty: false
        }))
      }

      // Make the target workspace active and the file's tab active, then
      // focus the editor after the activeTab-driven re-render has committed.
      dispatch(setActiveWorkspace(targetWorkspaceId))
      dispatch(setActiveTab(targetTabId))
      requestAnimationFrame(() => editorRef.current?.focus())
    })

    return unsubscribe
  }, [tabs, dispatch, workspaces])

  // Undo/Redo handlers for Monaco editor
  const handleUndo = useCallback(() => {
    editorRef.current?.trigger('keyboard', 'undo', null)
    editorRef.current?.focus()
  }, [])

  const handleRedo = useCallback(() => {
    editorRef.current?.trigger('keyboard', 'redo', null)
    editorRef.current?.focus()
  }, [])

  // Stable bag of handlers shared by the keyboard hook, the native menu IPC
  // listener, and the command palette. All registry commands route through
  // these — so the same code path runs whether the user pressed a shortcut,
  // clicked a menu item, or picked the command from the palette.
  const commandHandlers = useMemo<CommandContext['handlers']>(() => ({
    onFileNew: handleNewFile,
    onFileOpen: handleOpen,
    onFileSave: handleSave,
    onFileSaveAs: handleSaveAs,
    onCloseTab: handleCloseTab,
    onEditUndo: handleUndo,
    onEditRedo: handleRedo,
    onOpenPreferences: () => setPreferencesOpen(true),
    onOpenFolder: handleAddWorkspace,
    onOpenCommandPalette: () => setCommandPaletteOpen(true)
  }), [handleNewFile, handleOpen, handleSave, handleSaveAs, handleCloseTab, handleUndo, handleRedo, handleAddWorkspace])

  // Window-level keyboard shortcut dispatcher. Reads bindings from Redux and
  // routes matching events through the registry. Editor-focused commands
  // (markdown formatting etc.) are registered as Monaco actions in
  // MonacoEditor.tsx; mouse gestures and the tap-modifier have their own
  // handlers in this file.
  useKeyboardShortcuts({
    editorRef,
    handlers: commandHandlers,
    previewSelection
  })

  // KBD-013: the native menu emits registry command IDs; route them through
  // the registry's `execute` so menu and keyboard share one code path.
  useEffect(() => {
    const unsubscribe = window.electron.onMenuCommand((commandId: string) => {
      const cmd = commandMap.get(commandId)
      if (!cmd) {
        console.warn('Menu emitted unknown command id:', commandId)
        return
      }
      const ctx: CommandContext = {
        editor: editorRef.current,
        dispatch: dispatch as (action: unknown) => void,
        getState: store.getState,
        previewSelection,
        handlers: commandHandlers
      }
      cmd.execute(ctx)
    })

    return unsubscribe
  }, [dispatch, previewSelection, commandHandlers])

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
    await window.electron.window.exportHtml(htmlDoc, title)
  }, [activeTab?.filename])

  // Export as PDF - renders markdown to a hidden window for clean output
  const handleExportPdf = useCallback(async () => {
    const previewElement = document.querySelector('.markdown-body')
    if (!previewElement) return

    const html = previewElement.innerHTML
    const title = activeTab?.filename?.replace(/\.md$/, '') || 'Document'

    // Create standalone HTML document with embedded styles for PDF
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
      max-width: 100%;
      margin: 0;
      padding: 20px;
      color: #333;
      background-color: white;
    }
    h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; color: black; }
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: .3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: .3em; }
    h3 { font-size: 1.25em; }
    p { margin-top: 0; margin-bottom: 16px; }
    a { color: #0366d6; text-decoration: none; }
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

    await window.electron.window.exportPdf(htmlDoc, title)
  }, [activeTab?.filename])

  // Monaco theme based on app theme
  const monacoTheme = getMonacoThemeName(theme)

  return (
    <div className={`platform-${window.electron.platform}`} style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'row' }}>
      <Allotment>
        <Allotment.Pane minSize={180} preferredSize={250} maxSize={500}>
          <Sidebar
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
            onFileOpenFromTree={handleFileOpenFromTree}
            onAddWorkspace={handleAddWorkspace}
            content={content}
            editorRef={editorRef}
          />
        </Allotment.Pane>
        <Allotment.Pane>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
            {/* Tab row with window controls */}
            <div className="tab-row">
              {tabs.length > 0 && (
                <TabBar
                  onCloseTab={async (tabId) => {
                    const tabToClose = tabs.find((t) => t.id === tabId)
                    if (tabToClose && !tabToClose.path) {
                      await window.electron.file.cleanupTemp(tabId)
                    }
                  }}
                />
              )}
              <div className="tab-row-drag-spacer" />
              {window.electron.platform !== 'win32' && <WindowControls />}
            </div>

            {/* Content area */}
            <div ref={contentAreaRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
              {tabs.length === 0 ? (
                <EmptyState onNewFile={handleNewFile} onOpenFile={handleOpen} />
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                      filePath={currentFilePath}
                      editorRef={editorRef}
                      onCursorPositionChange={handleCursorPositionChange}
                      onScrollTopChange={handleScrollTopChange}
                      onPreviewSelectionChange={setPreviewSelection}
                      vimStatusBarRef={vimStatusBarRef}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Allotment.Pane>
      </Allotment>
      {showToolbar && tabs.length > 0 && (
        <FloatingToolbar
          editorRef={editorRef}
          previewSelection={previewSelection}
          containerRef={contentAreaRef}
          activeTabId={activeTab?.id}
          viewMode={viewMode}
          isMarkdown={isMarkdownFile(activeTab?.path)}
        />
      )}
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
            handlers: commandHandlers
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
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </ThemeProvider>
    </Provider>
  )
}

export default App
