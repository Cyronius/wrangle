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
}

/**
 * Hook that manages keyboard shortcuts for the application.
 * - Registers Monaco editor actions with current bindings
 * - Handles global (non-editor) shortcuts via window keydown listener
 */
export function useKeyboardShortcuts({ editorRef, handlers }: UseKeyboardShortcutsOptions) {
  const dispatch = useDispatch<AppDispatch>()
  const bindings = useSelector(selectCurrentBindings)
  const disposablesRef = useRef<monaco.IDisposable[]>([])

  // Create command context
  const getCommandContext = useCallback((): CommandContext => {
    return {
      editor: editorRef.current,
      dispatch,
      getState: () => ({}), // We use useSelector instead
      handlers
    }
  }, [dispatch, editorRef, handlers])

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
        // Allow some shortcuts even in inputs
        const allowInInput = ['file.save', 'file.saveAs', 'file.new', 'file.open', 'app.preferences']

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
