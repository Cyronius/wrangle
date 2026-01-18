import { useEffect, useRef, useState, useCallback } from 'react'
import { useSelector, useDispatch, Provider } from 'react-redux'
import { store, RootState, AppDispatch } from './store/store'
import { setViewMode, zoomIn, zoomOut, resetZoom, toggleOutline } from './store/layoutSlice'
import { setTheme } from './store/themeSlice'
import { addTab, updateTab, setActiveTab, closeTab, nextTab, previousTab } from './store/tabsSlice'
import { loadSettings } from './store/settingsSlice'
import { EditorLayout } from './components/Layout/EditorLayout'
import { TabBar } from './components/Tabs/TabBar'
import { MarkdownToolbar } from './components/UI/MarkdownToolbar'
import { TitleBar } from './components/TitleBar/TitleBar'
import { ThemeProvider } from './components/ThemeProvider'
import { OutlineSidebar } from './components/Outline/OutlineSidebar'
import { PreferencesDialog } from './components/Preferences/PreferencesDialog'
import { EmptyState } from './components/EmptyState'
import { useImageDrop } from './hooks/useImageDrop'
import { extractH1 } from './utils/extractH1'
import * as monaco from 'monaco-editor'

function AppContent() {
  const dispatch = useDispatch<AppDispatch>()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Redux state
  const { tabs, activeTabId } = useSelector((state: RootState) => state.tabs)
  const theme = useSelector((state: RootState) => state.theme.currentTheme)
  const showOutline = useSelector((state: RootState) => state.layout.showOutline)

  // Preferences dialog state
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  // Load settings on mount
  useEffect(() => {
    dispatch(loadSettings())
  }, [dispatch])

  // Get active tab
  const activeTab = tabs.find(t => t.id === activeTabId)

  // Local state for current content
  const [content, setContent] = useState(activeTab?.content || '')
  const [currentFilePath, setCurrentFilePath] = useState<string | undefined>(activeTab?.path)
  const [baseDir, setBaseDir] = useState<string | null>(null)

  // Update local state when active tab changes
  useEffect(() => {
    if (activeTab) {
      setContent(activeTab.content)
      setCurrentFilePath(activeTab.path)

      // Calculate base directory for image preview
      if (activeTab.path) {
        // Extract directory from file path
        const lastSlash = Math.max(activeTab.path.lastIndexOf('/'), activeTab.path.lastIndexOf('\\'))
        if (lastSlash !== -1) {
          setBaseDir(activeTab.path.substring(0, lastSlash))
        }
      } else {
        // For unsaved files, use temp directory
        window.electron.file.getTempDir(activeTab.id).then((tempDir) => {
          setBaseDir(tempDir)
        })
      }
    } else {
      // No active tab - show empty state
      setContent('')
      setCurrentFilePath(undefined)
      setBaseDir(null)
    }
  }, [activeTabId, activeTab])

  // Auto-save function
  const performAutoSave = async () => {
    if (!activeTab) return

    try {
      await window.electron.file.autoSave(activeTab.id, content, activeTab.path || null)
    } catch (error) {
      console.error('Auto-save failed:', error)
    }
  }

  // Handle content change
  const handleChange = (value: string | undefined) => {
    const newContent = value || ''
    setContent(newContent)

    // Mark tab as dirty if content changed
    if (activeTab && newContent !== activeTab.content) {
      // Extract H1 for unsaved files to use as display title
      const displayTitle = !activeTab.path ? extractH1(newContent) || undefined : undefined

      dispatch(updateTab({
        id: activeTab.id,
        content: newContent,
        isDirty: true,
        displayTitle
      }))

      // Trigger auto-save with debouncing (2.5 seconds)
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
      autoSaveTimeoutRef.current = setTimeout(performAutoSave, 2500)
    }
  }

  // Clean up auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

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
  }, [dispatch, viewMode])

  // Close tab handler
  const handleCloseTab = useCallback(async () => {
    if (!activeTab) return

    // Close tab and cleanup temp files if unsaved
    if (!activeTab.path) {
      await window.electron.file.cleanupTemp(activeTab.id)
    }
    dispatch(closeTab(activeTab.id))
  }, [activeTab, dispatch])

  const handleOpen = useCallback(async () => {
    const fileData = await window.electron.file.open()
    if (fileData) {
      // Check if file is already open
      const existingTab = tabs.find(t => t.path === fileData.path)
      if (existingTab) {
        dispatch(setActiveTab(existingTab.id))
        return
      }

      // Create new tab
      const filename = fileData.path.split(/[\\/]/).pop() || 'Untitled'
      const newTabId = `tab-${Date.now()}`
      dispatch(addTab({
        id: newTabId,
        filename,
        content: fileData.content,
        path: fileData.path,
        isDirty: false
      }))
      dispatch(setActiveTab(newTabId))
    }
  }, [tabs, dispatch])

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
      setCurrentFilePath(filePath)

      // Update base directory for preview
      const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
      if (lastSlash !== -1) {
        setBaseDir(filePath.substring(0, lastSlash))
      }

      // Clear auto-save timeout since we just saved
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
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

        // Clear auto-save timeout since we just saved
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current)
        }
      }
    } else {
      // No path, do save as
      await handleSaveAs()
    }
  }, [activeTab, content, dispatch, handleSaveAs])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      // Ctrl+PageDown: Next tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'PageDown') {
        e.preventDefault()
        dispatch(nextTab())
      }
      // Ctrl+PageUp: Previous tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'PageUp') {
        e.preventDefault()
        dispatch(previousTab())
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
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewFile, handleCloseTab, handleOpen, handleSave, handleSaveAs, dispatch])

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
          dispatch(setTheme('light'))
          break
        case 'theme:dark':
          dispatch(setTheme('dark'))
          break
      }
    })

    return unsubscribe
  }, [activeTab, content, dispatch])

  // Image drop support
  const { isDragging } = useImageDrop({
    editorRef,
    tabId: activeTab?.id,
    currentFilePath,
    onImageInsert: (imagePath) => {
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
        <TabBar
          onCloseTab={async (tabId) => {
            // Clean up temp directory if tab was never saved
            const tabToClose = tabs.find((t) => t.id === tabId)
            if (tabToClose && !tabToClose.path) {
              await window.electron.file.cleanupTemp(tabId)
            }
          }}
        />
      </TitleBar>
      {tabs.length > 0 && <MarkdownToolbar editorRef={editorRef} />}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        {tabs.length === 0 ? (
          <EmptyState onNewFile={handleNewFile} onOpenFile={handleOpen} />
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
              />
            </div>
          </>
        )}
      </div>
      <PreferencesDialog
        isOpen={preferencesOpen}
        onClose={() => setPreferencesOpen(false)}
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
