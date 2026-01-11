import { Editor } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { forwardRef, useImperativeHandle, useRef } from 'react'

interface MonacoEditorProps {
  value: string
  onChange: (value: string | undefined) => void
  theme?: 'vs-dark' | 'vs'
}

export const MonacoEditor = forwardRef<monaco.editor.IStandaloneCodeEditor | null, MonacoEditorProps>(
  ({ value, onChange, theme = 'vs-dark' }, ref) => {
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

    useImperativeHandle(ref, () => editorRef.current!)

    const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
      editorRef.current = editor
    // Register custom commands
    editor.addAction({
      id: 'uppercase',
      label: 'Convert to Uppercase',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyU],
      run: (ed) => {
        const selection = ed.getSelection()
        const text = ed.getModel()?.getValueInRange(selection!)
        if (text && selection) {
          ed.executeEdits('', [
            {
              range: selection,
              text: text.toUpperCase()
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
        fontSize: 14,
        lineNumbers: 'on',
        renderWhitespace: 'selection',
        scrollBeyondLastLine: false,
        folding: true,
        quickSuggestions: false,
        multiCursorModifier: 'ctrlCmd',
        find: {
          seedSearchStringFromSelection: 'always',
          autoFindInSelection: 'never'
        }
      }}
    />
  )
})
