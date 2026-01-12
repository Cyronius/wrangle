import { useEffect, useRef, useState, useCallback } from 'react'
import { useSelector, useDispatch, Provider } from 'react-redux'
import { store, RootState } from './store/store'
import { setViewMode, zoomIn, zoomOut, resetZoom } from './store/layoutSlice'
import { setTheme } from './store/themeSlice'
import { addTab, updateTab, setActiveTab, closeTab, nextTab, previousTab } from './store/tabsSlice'
import { MonacoEditor } from './components/Editor/MonacoEditor'
import { EditorLayout } from './components/Layout/EditorLayout'
import { TabBar } from './components/Tabs/TabBar'
import { MarkdownToolbar } from './components/UI/MarkdownToolbar'
import { TitleBar } from './components/TitleBar/TitleBar'
import { ThemeProvider } from './components/ThemeProvider'
import { useImageDrop } from './hooks/useImageDrop'
import * as monaco from 'monaco-editor'

function AppContent() {
  const dispatch = useDispatch()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Redux state
  const { tabs, activeTabId } = useSelector((state: RootState) => state.tabs)
  const theme = useSelector((state: RootState) => state.theme.currentTheme)

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
      // No tabs, create a welcome tab
      const welcomeId = `tab-${Date.now()}`
      dispatch(addTab({
        id: welcomeId,
        filename: 'Untitled',
        content: '',
        isDirty: false
      }))
    }
  }, [activeTabId, activeTab, dispatch])

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
      dispatch(updateTab({
        id: activeTab.id,
        content: newContent,
        isDirty: true
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
  }, [dispatch])

  // Close tab handler
  const handleCloseTab = useCallback(async () => {
    if (!activeTab) return

    if (tabs.length === 1) {
      // Last tab - close window
      window.electron.window.close()
    } else {
      // Close tab and cleanup temp files if unsaved
      if (!activeTab.path) {
        await window.electron.file.cleanupTemp(activeTab.id)
      }
      dispatch(closeTab(activeTab.id))
    }
  }, [activeTab, tabs.length, dispatch])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N: New file
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        handleNewFile()
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
      // F12: Toggle DevTools (fallback for when global shortcut fails)
      if (e.key === 'F12') {
        e.preventDefault()
        window.electron.window.toggleDevTools()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNewFile, handleCloseTab, dispatch])

  const handleOpen = async () => {
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
  }

  const handleSave = async () => {
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
  }

  const handleSaveAs = async () => {
    if (!activeTab) return

    const wasUnsaved = !activeTab.path

    const filePath = await window.electron.file.saveAs(content)
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
  }

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
      <MarkdownToolbar editorRef={editorRef} />
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
