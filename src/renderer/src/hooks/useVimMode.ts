import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { initVimMode, VimMode } from 'monaco-vim'
import * as monaco from 'monaco-editor'
import { selectVimMode } from '../store/settingsSlice'

interface UseVimModeOptions {
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
  statusBarRef: React.RefObject<HTMLDivElement | null>
  activeTabId: string | null
  handlers: {
    onSave: () => void
    onCloseTab: () => void
    onOpen: () => void
  }
}

export function useVimMode({ editorRef, statusBarRef, activeTabId, handlers }: UseVimModeOptions) {
  const vimEnabled = useSelector(selectVimMode)
  const vimModeRef = useRef<{ dispose: () => void } | null>(null)
  const handlersRef = useRef(handlers)

  // Keep handlers ref up to date to avoid stale closures in ex commands
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    const editor = editorRef.current
    const statusBar = statusBarRef.current

    // Dispose existing vim mode first
    if (vimModeRef.current) {
      vimModeRef.current.dispose()
      vimModeRef.current = null
    }

    if (!vimEnabled || !editor || !statusBar) {
      return
    }

    // Initialize vim mode
    const vimModeInstance = initVimMode(editor, statusBar)
    vimModeRef.current = vimModeInstance

    // Define ex commands
    VimMode.Vim.defineEx('write', 'w', () => {
      handlersRef.current.onSave()
    })

    VimMode.Vim.defineEx('quit', 'q', () => {
      handlersRef.current.onCloseTab()
    })

    VimMode.Vim.defineEx('wq', 'wq', () => {
      handlersRef.current.onSave()
      setTimeout(() => handlersRef.current.onCloseTab(), 100)
    })

    VimMode.Vim.defineEx('edit', 'e', () => {
      handlersRef.current.onOpen()
    })

    return () => {
      if (vimModeRef.current) {
        vimModeRef.current.dispose()
        vimModeRef.current = null
      }
    }
  }, [vimEnabled, activeTabId, editorRef, statusBarRef])

  return { vimEnabled }
}
