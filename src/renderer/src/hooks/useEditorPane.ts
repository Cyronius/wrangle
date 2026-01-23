import { useEffect, useRef, useState, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store/store'
import {
  updateTab,
  updateTabPosition,
  updateTabScroll,
  selectActiveTabByWorkspace,
  selectActiveTabIdByWorkspace
} from '../store/tabsSlice'
import { WorkspaceId } from '../../../shared/workspace-types'
import { extractH1 } from '../utils/extractH1'
import * as monaco from 'monaco-editor'

export interface UseEditorPaneResult {
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
  content: string
  baseDir: string | null
  currentFilePath: string | undefined
  activeTab: ReturnType<typeof selectActiveTabByWorkspace>
  handleChange: (value: string | undefined) => void
  handleCursorPositionChange: (position: { lineNumber: number; column: number }) => void
  handleScrollTopChange: (scrollTop: number) => void
}

/**
 * Hook that manages editor state for a single workspace pane.
 * Extracts content routing, auto-save, cursor/scroll tracking into a reusable unit.
 */
export function useEditorPane(workspaceId: WorkspaceId): UseEditorPaneResult {
  const dispatch = useDispatch<AppDispatch>()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Redux state for this workspace's active tab
  const activeTab = useSelector((state: RootState) => selectActiveTabByWorkspace(state, workspaceId))
  const activeTabId = useSelector((state: RootState) => selectActiveTabIdByWorkspace(state, workspaceId))

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

      // Restore cursor and scroll position after editor has rendered the new content
      requestAnimationFrame(() => {
        const editor = editorRef.current
        if (!editor) return

        if (activeTab.cursorPosition) {
          editor.setPosition(activeTab.cursorPosition)
          editor.revealPositionInCenter(activeTab.cursorPosition)
        }
        if (activeTab.scrollTop != null) {
          editor.setScrollTop(activeTab.scrollTop)
        }
      })
    } else {
      setContent('')
      setCurrentFilePath(undefined)
      setBaseDir(null)
    }
  }, [activeTabId, activeTab])

  // Auto-save function
  const performAutoSave = useCallback(async () => {
    if (!activeTab) return
    try {
      await window.electron.file.autoSave(activeTab.id, content, activeTab.path || null)
    } catch (error) {
      console.error('Auto-save failed:', error)
    }
  }, [activeTab, content])

  // Debounced cursor/scroll position tracking
  const positionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleCursorPositionChange = useCallback((position: { lineNumber: number; column: number }) => {
    if (!activeTab) return
    if (positionTimeoutRef.current) {
      clearTimeout(positionTimeoutRef.current)
    }
    positionTimeoutRef.current = setTimeout(() => {
      dispatch(updateTabPosition({ id: activeTab.id, cursorPosition: position }))
    }, 300)
  }, [activeTab, dispatch])

  const handleScrollTopChange = useCallback((scrollTop: number) => {
    if (!activeTab) return
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(() => {
      dispatch(updateTabScroll({ id: activeTab.id, scrollTop }))
    }, 300)
  }, [activeTab, dispatch])

  // Handle content change
  const handleChange = useCallback((value: string | undefined) => {
    const newContent = value || ''
    setContent(newContent)

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
      autoSaveTimeoutRef.current = setTimeout(() => {
        performAutoSave()
      }, 2500)
    }
  }, [activeTab, dispatch, performAutoSave])

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
      if (positionTimeoutRef.current) {
        clearTimeout(positionTimeoutRef.current)
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  return {
    editorRef,
    content,
    baseDir,
    currentFilePath,
    activeTab,
    handleChange,
    handleCursorPositionChange,
    handleScrollTopChange
  }
}
