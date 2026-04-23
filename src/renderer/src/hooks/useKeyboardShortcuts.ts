import { useEffect, useCallback, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import * as monaco from 'monaco-editor'
import { RootState, AppDispatch } from '../store/store'
import { selectCurrentBindings, ShortcutBindings } from '../store/settingsSlice'
import { commands, CommandContext, commandMap } from '../commands/registry'
import { matchesShortcut, parseShortcutToMonaco } from '../utils/shortcut-parser'

interface UseKeyboardShortcutsOptions {
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
  handlers: CommandContext['handlers']
  previewSelection?: { start: number; end: number } | null
}

/**
 * Hook that manages keyboard shortcuts for the application.
 * - Registers Monaco editor actions with current bindings
 * - Handles global (non-editor) shortcuts via window keydown listener
 */
export function useKeyboardShortcuts({ editorRef, handlers, previewSelection }: UseKeyboardShortcutsOptions) {
  const dispatch = useDispatch<AppDispatch>()
  const bindings = useSelector(selectCurrentBindings)
  const disposablesRef = useRef<monaco.IDisposable[]>([])

  // Create command context
  const getCommandContext = useCallback((): CommandContext => {
    return {
      editor: editorRef.current,
      dispatch,
      getState: () => ({}), // We use useSelector instead
      previewSelection,
      handlers
    }
  }, [dispatch, editorRef, handlers, previewSelection])

  // Execute a command by ID
  const executeCommand = useCallback(
    (commandId: string) => {
      const command = commandMap.get(commandId)
      if (command) {
        command.execute(getCommandContext())
      }
    },
    [getCommandContext]
  )

  // Register Monaco editor actions
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    // Dispose previous actions
    disposablesRef.current.forEach((d) => d.dispose())
    disposablesRef.current = []

    // Register actions for commands with bindings
    for (const command of commands) {
      const binding = bindings[command.id]
      if (!binding) continue

      const monacoKeybinding = parseShortcutToMonaco(binding)
      if (!monacoKeybinding) continue

      // Skip certain commands that Monaco handles natively or that are global
      const globalCommands = [
        'file.new',
        'file.open',
        'file.save',
        'file.saveAs',
        'file.close',
        'file.print',
        'app.preferences',
        'view.devTools',
        'view.outline',
        'view.explorer',
        'view.toolbar',
        'nav.nextTab',
        'nav.prevTab',
        'nav.nextWorkspace',
        'nav.prevWorkspace'
      ]
      if (globalCommands.includes(command.id)) continue

      try {
        const disposable = editor.addAction({
          id: command.id,
          label: command.label,
          keybindings: [monacoKeybinding],
          run: () => executeCommand(command.id)
        })
        disposablesRef.current.push(disposable)
      } catch (e) {
        console.warn(`Failed to register action ${command.id}:`, e)
      }
    }

    return () => {
      disposablesRef.current.forEach((d) => d.dispose())
      disposablesRef.current = []
    }
  }, [editorRef.current, bindings, executeCommand])

  // Handle global shortcuts (window-level, outside Monaco)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle if a modal or input is focused (except Monaco)
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow some shortcuts even in inputs (including markdown formatting for WYSIWYG)
        const allowInInput = [
          'file.save', 'file.saveAs', 'file.new', 'file.open', 'app.preferences',
          'markdown.bold', 'markdown.italic', 'markdown.strikethrough', 'markdown.code',
          'markdown.link', 'markdown.heading1', 'markdown.heading2', 'markdown.heading3',
          'markdown.heading4', 'markdown.heading5', 'markdown.heading6'
        ]

        for (const commandId of allowInInput) {
          const binding = bindings[commandId]
          if (binding && matchesShortcut(event, binding)) {
            event.preventDefault()
            executeCommand(commandId)
            return
          }
        }
        return
      }

      // Check global commands
      const globalCommands = [
        'file.new',
        'file.open',
        'file.save',
        'file.saveAs',
        'file.close',
        'file.print',
        'app.preferences',
        'view.devTools',
        'view.editorOnly',
        'view.split',
        'view.previewOnly',
        'view.toggleSync',
        'view.workspaceSidebar',
        'view.outline',
        'view.explorer',
        'view.toolbar',
        'view.zoomIn',
        'view.zoomOut',
        'view.resetZoom',
        'nav.nextTab',
        'nav.prevTab',
        'nav.nextWorkspace',
        'nav.prevWorkspace'
      ]

      for (const commandId of globalCommands) {
        const binding = bindings[commandId]
        if (binding && matchesShortcut(event, binding)) {
          event.preventDefault()
          executeCommand(commandId)
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [bindings, executeCommand])

  // Tap-Alt (press and release Alt with no other key or mouse input) opens
  // the markdown format toolbar at the caret. Mirrors the idiom used by the
  // Windows menu accelerator. We listen on both document (capture phase) and
  // directly on the Monaco editor, because Monaco can swallow Alt keyup when
  // focused.
  useEffect(() => {
    const TAP_MAX_MS = 500
    let altDownAt = 0
    let candidate = false

    const onAltDown = (src: string) => {
      altDownAt = Date.now()
      candidate = true
      console.log('[tap-alt] down via', src, 'candidate=', candidate)
    }

    const onAltUp = (src: string) => {
      const wasCandidate = candidate
      const elapsed = Date.now() - altDownAt
      candidate = false
      console.log('[tap-alt] up via', src, 'wasCandidate=', wasCandidate, 'elapsed=', elapsed)
      if (wasCandidate && elapsed <= TAP_MAX_MS) {
        console.log('[tap-alt] FIRING markdown.openFormatToolbar')
        executeCommand('markdown.openFormatToolbar')
      }
    }

    const cancel = (reason: string) => {
      if (candidate) console.log('[tap-alt] cancel:', reason)
      candidate = false
    }

    const onDocKeyDown = (e: KeyboardEvent) => {
      console.log('[tap-alt] doc keydown key=', e.key, 'code=', e.code, 'alt=', e.altKey, 'ctrl=', e.ctrlKey, 'shift=', e.shiftKey, 'meta=', e.metaKey, 'repeat=', e.repeat, 'target=', (e.target as HTMLElement)?.tagName)
      if (e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        if (!candidate) onAltDown('doc-keydown')
        return
      }
      if (candidate) cancel('doc-keydown ' + e.key)
    }

    const onDocKeyUp = (e: KeyboardEvent) => {
      console.log('[tap-alt] doc keyup key=', e.key, 'code=', e.code)
      if (e.key === 'Alt') {
        e.preventDefault()
        onAltUp('doc-keyup')
      }
    }

    const onMouseDown = () => cancel('mousedown')
    const onBlur = () => cancel('blur')

    document.addEventListener('keydown', onDocKeyDown, true)
    document.addEventListener('keyup', onDocKeyUp, true)
    document.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('blur', onBlur)

    // Also listen directly on the Monaco editor — when it's focused, it may
    // consume key events before document listeners see them.
    const editor = editorRef.current
    const monacoDisposables: monaco.IDisposable[] = []
    console.log('[tap-alt] effect registered, editor=', !!editor)
    if (editor) {
      monacoDisposables.push(
        editor.onKeyDown((e) => {
          console.log('[tap-alt] monaco keydown keyCode=', e.keyCode, 'alt=', e.altKey, 'ctrl=', e.ctrlKey, 'shift=', e.shiftKey, 'meta=', e.metaKey)
          if (e.keyCode === monaco.KeyCode.Alt && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
            if (!candidate) onAltDown('monaco-keydown')
            return
          }
          if (candidate) cancel('monaco-keydown ' + e.keyCode)
        })
      )
      monacoDisposables.push(
        editor.onKeyUp((e) => {
          console.log('[tap-alt] monaco keyup keyCode=', e.keyCode)
          if (e.keyCode === monaco.KeyCode.Alt) {
            onAltUp('monaco-keyup')
          }
        })
      )
    }

    return () => {
      document.removeEventListener('keydown', onDocKeyDown, true)
      document.removeEventListener('keyup', onDocKeyUp, true)
      document.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('blur', onBlur)
      monacoDisposables.forEach((d) => d.dispose())
    }
  }, [executeCommand, editorRef.current])

  return { executeCommand, bindings }
}

/**
 * Hook to create a debounced callback
 */
export function useDebounce<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  ) as T

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}
