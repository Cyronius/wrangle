import { Editor } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { forwardRef, useRef } from 'react'
import { markdownCommands } from '../../utils/markdown-commands'

interface MonacoEditorProps {
  value: string
  onChange: (value: string | undefined) => void
  theme?: 'vs-dark' | 'vs'
  fontSize?: number
}

export const MonacoEditor = forwardRef<monaco.editor.IStandaloneCodeEditor | null, MonacoEditorProps>(
  ({ value, onChange, theme = 'vs-dark', fontSize = 14 }, ref) => {
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

    const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
      editorRef.current = editor

      // Update forwarded ref immediately after mount
      if (typeof ref === 'function') {
        ref(editor)
      } else if (ref) {
        ref.current = editor
      }

      // Register custom commands
      editor.addAction({
        id: 'toggleCase',
        label: 'Toggle Case',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyU],
        run: (ed) => {
          const selection = ed.getSelection()
          const text = ed.getModel()?.getValueInRange(selection!)
          if (text && selection) {
            // Toggle: if all uppercase, convert to lowercase; otherwise convert to uppercase
            const isUppercase = text === text.toUpperCase() && text !== text.toLowerCase()
            ed.executeEdits('', [
              {
                range: selection,
                text: isUppercase ? text.toLowerCase() : text.toUpperCase()
              }
            ])
          }
        }
      })

      editor.addAction({
        id: 'lowercase',
        label: 'Convert to Lowercase',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL],
        run: (ed) => {
          const selection = ed.getSelection()
          const text = ed.getModel()?.getValueInRange(selection!)
          if (text && selection) {
            ed.executeEdits('', [
              {
                range: selection,
                text: text.toLowerCase()
              }
            ])
          }
        }
      })

      // Markdown formatting shortcuts
      editor.addAction({
        id: 'markdown-bold',
        label: 'Bold',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
        run: (ed) => markdownCommands.bold(ed)
      })

      editor.addAction({
        id: 'markdown-italic',
        label: 'Italic',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
        run: (ed) => markdownCommands.italic(ed)
      })

      editor.addAction({
        id: 'markdown-strikethrough',
        label: 'Strikethrough',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyX],
        run: (ed) => markdownCommands.strikethrough(ed)
      })

      editor.addAction({
        id: 'markdown-inline-code',
        label: 'Inline Code',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote],
        run: (ed) => markdownCommands.inlineCode(ed)
      })

      editor.addAction({
        id: 'markdown-link',
        label: 'Insert Link',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
        run: (ed) => markdownCommands.link(ed)
      })

      editor.addAction({
        id: 'markdown-table',
        label: 'Insert Table',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyT],
        run: (ed) => markdownCommands.table(ed)
      })
    }

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
          find: {
            seedSearchStringFromSelection: 'always',
            autoFindInSelection: 'never'
          }
        }}
      />
    )
  }
)
