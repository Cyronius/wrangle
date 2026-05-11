import { useEffect, useCallback, useRef } from 'react'
import { useSelector, useDispatch, useStore } from 'react-redux'
import * as monaco from 'monaco-editor'
import { RootState, AppDispatch } from '../store/store'
import { selectCurrentBindings } from '../store/settingsSlice'
import { CommandContext, CommandDefinition, commandMap } from '../commands/registry'
import { matchesShortcut } from '../utils/shortcut-parser'

interface UseKeyboardShortcutsOptions {
  editorRef: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>
  handlers: CommandContext['handlers']
  previewSelection?: { start: number; end: number } | null
}

// Commands routed via the window-level keydown handler. Editor-only commands
// (markdown formatting, edit.toggleCase, etc.) are registered as Monaco
// actions in MonacoEditor.tsx so they fire when the editor has focus. Mouse
// gestures (`view.zoomScroll`, `view.moveWindow`) and the tap-modifier
// (`markdown.openFormatToolbar`) have dedicated handlers in App.tsx.
export const GLOBAL_COMMANDS = [
  'file.new',
  'file.open',
  'file.save',
  'file.saveAs',
  'file.close',
  'file.print',
  'app.preferences',
  'app.commandPalette',
  'app.exit',
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
  'view.reload',
  'view.forceReload',
  'view.toggleFullscreen',
  'nav.nextTab',
  'nav.prevTab',
  'nav.nextWorkspace',
  'nav.prevWorkspace',
  'workspace.openFolder'
] as const

// Subset of commands that are also allowed to fire when an input/textarea or
// contentEditable element is focused — needed for save-while-typing and for
// markdown formatting in the WYSIWYG preview pane.
export const INPUT_ALLOWED_COMMANDS = [
  'file.save',
  'file.saveAs',
  'file.new',
  'file.open',
  'app.preferences',
  'app.commandPalette',
  'markdown.bold',
  'markdown.italic',
  'markdown.strikethrough',
  'markdown.code',
  'markdown.link',
  'markdown.heading1',
  'markdown.heading2',
  'markdown.heading3',
  'markdown.heading4',
  'markdown.heading5',
  'markdown.heading6'
] as const

export type FocusContext = 'global' | 'input'

/**
 * Classify the focus context of a keyboard event by inspecting `event.target`.
 * `input` covers `<input>` / `<textarea>` / contentEditable; `global` is
 * everything else (window focus, body, non-editable element).
 *
 * Monaco's hidden `<textarea>` inside `.monaco-editor` is conceptually editor
 * focus, not generic input focus — pressing `Ctrl+2` while typing must still
 * dispatch `view.split`. We treat any descendant of `.monaco-editor` as
 * `global` so the full dispatch list runs. Commands routed via Monaco's own
 * action registry (markdown formatting, edit.toggleCase) are NOT in
 * GLOBAL_COMMANDS, so the dispatcher returns no match and Monaco's
 * `editor.addAction` handler fires on the event's continued propagation.
 */
export function getFocusContextFromTarget(target: EventTarget | null): FocusContext {
  const el = target as HTMLElement | null
  if (!el) return 'global'
  if (typeof el.closest === 'function' && el.closest('.monaco-editor')) {
    return 'global'
  }
  const inEditableTarget =
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.isContentEditable === true
  return inEditableTarget ? 'input' : 'global'
}

export interface DispatchResult {
  /** The id of the command that was matched and executed, or null if no match. */
  commandId: string | null
}

/**
 * Pure window-level keystroke dispatcher. Given an event, the active bindings,
 * a command lookup, and a focus context, finds the matching command and runs
 * its `execute` exactly once. Returns the matched command id (or null).
 *
 * Extracted from `useKeyboardShortcuts` so it can be unit-tested without React
 * (KBD-016). Editor-scoped commands (markdown formatting, edit.toggleCase) are
 * NOT dispatched here — `MonacoEditor.tsx` registers those as Monaco actions
 * keyed by the same bindings.
 */
export function dispatchKeydownEvent(
  event: KeyboardEvent,
  bindings: Record<string, string | null>,
  commandLookup: Map<string, CommandDefinition>,
  focusContext: FocusContext,
  buildContext: () => CommandContext
): DispatchResult {
  const candidates = focusContext === 'input' ? INPUT_ALLOWED_COMMANDS : GLOBAL_COMMANDS

  for (const commandId of candidates) {
    const binding = bindings[commandId]
    if (!binding) continue
    if (matchesShortcut(event, binding)) {
      event.preventDefault()
      event.stopPropagation()
      const command = commandLookup.get(commandId)
      if (command) {
        command.execute(buildContext())
      }
      return { commandId }
    }
  }
  return { commandId: null }
}

/**
 * Window-level keyboard shortcut dispatcher. Reads the active preset bindings
 * from Redux and routes matching events to the registry's `execute`. Editor
 * commands are NOT registered here — MonacoEditor.tsx owns those.
 */
export function useKeyboardShortcuts({ editorRef, handlers, previewSelection }: UseKeyboardShortcutsOptions) {
  const dispatch = useDispatch<AppDispatch>()
  const store = useStore<RootState>()
  const bindings = useSelector(selectCurrentBindings)

  const previewSelectionRef = useRef(previewSelection)
  useEffect(() => {
    previewSelectionRef.current = previewSelection
  }, [previewSelection])

  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  const buildContext = useCallback((): CommandContext => ({
    editor: editorRef.current,
    dispatch,
    getState: store.getState,
    previewSelection: previewSelectionRef.current,
    handlers: handlersRef.current
  }), [dispatch, editorRef, store])

  const executeCommand = useCallback(
    (commandId: string) => {
      const command = commandMap.get(commandId)
      if (!command) return
      command.execute(buildContext())
    },
    [buildContext]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const focusContext = getFocusContextFromTarget(event.target)
      dispatchKeydownEvent(event, bindings, commandMap, focusContext, buildContext)
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [bindings, buildContext])

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
