import { Editor } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { forwardRef, useRef, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { selectCurrentBindings, ShortcutBindings } from '../../store/settingsSlice'
import { parseShortcutToMonaco } from '../../utils/shortcut-parser'
import { commandMap } from '../../commands/registry'

interface MonacoEditorProps {
  value: string
  onChange: (value: string | undefined) => void
  theme?: 'vs-dark' | 'vs'
  fontSize?: number
}

export const MonacoEditor = forwardRef<monaco.editor.IStandaloneCodeEditor | null, MonacoEditorProps>(
  ({ value, onChange, theme = 'vs-dark', fontSize = 14 }, ref) => {
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
    const disposablesRef = useRef<monaco.IDisposable[]>([])
    const bindings = useSelector(selectCurrentBindings)

    // Register editor actions based on current bindings
    const registerEditorActions = useCallback(
      (editor: monaco.editor.IStandaloneCodeEditor, currentBindings: ShortcutBindings) => {
        // Dispose previous actions
        disposablesRef.current.forEach((d) => d.dispose())
        disposablesRef.current = []

        // Commands to register in Monaco editor
        const editorCommands = [
          'edit.toggleCase',
          'edit.lowercase',
          'markdown.bold',
          'markdown.italic',
          'markdown.strikethrough',
          'markdown.code',
          'markdown.link',
          'markdown.table',
          'markdown.heading1',
          'markdown.heading2',
          'markdown.heading3',
          'markdown.heading4',
          'markdown.heading5',
          'markdown.heading6',
          'markdown.bulletList',
          'markdown.numberedList',
          'markdown.taskList',
          'markdown.blockquote',
          'markdown.codeBlock',
          'markdown.image',
          'markdown.hr'
        ]

        for (const commandId of editorCommands) {
          const command = commandMap.get(commandId)
          if (!command) continue

          const binding = currentBindings[commandId]
          const keybinding = binding ? parseShortcutToMonaco(binding) : null

          try {
            const disposable = editor.addAction({
              id: commandId,
              label: command.label,
              keybindings: keybinding ? [keybinding] : [],
              run: () => {
                // Create a minimal context for the command
                command.execute({
                  editor,
                  dispatch: () => {},
                  getState: () => ({}),
                  handlers: {
                    onFileNew: () => {},
                    onFileOpen: () => {},
                    onFileSave: () => {},
                    onFileSaveAs: () => {},
                    onCloseTab: () => {},
                    onEditUndo: () => {},
                    onEditRedo: () => {},
                    onOpenPreferences: () => {}
                  }
                })
              }
            })
            disposablesRef.current.push(disposable)
          } catch (e) {
            console.warn(`Failed to register action ${commandId}:`, e)
          }
        }
      },
      []
    )

    const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
      editorRef.current = editor

      // Update forwarded ref immediately after mount
      if (typeof ref === 'function') {
        ref(editor)
      } else if (ref) {
        ref.current = editor
      }

      // Register actions with current bindings
      registerEditorActions(editor, bindings)
    }

    // Re-register actions when bindings change
    useEffect(() => {
      if (editorRef.current) {
        registerEditorActions(editorRef.current, bindings)
      }
    }, [bindings, registerEditorActions])

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        disposablesRef.current.forEach((d) => d.dispose())
        disposablesRef.current = []
      }
    }, [])

    return (
      <Editor
        height="100%"
        defaultLanguage="markdown"
        theme={theme}
        value={value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        options={{
          automaticLayout: true,
          wordWrap: 'on',
          minimap: { enabled: false },
          fontSize,
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          scrollBeyondLastLine: false,
          folding: true,
          quickSuggestions: false,
          multiCursorModifier: 'ctrlCmd',
          mouseWheelZoom: false,
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: false,
          find: {
            seedSearchStringFromSelection: 'always',
            autoFindInSelection: 'never'
          }
        }}
      />
    )
  }
)
