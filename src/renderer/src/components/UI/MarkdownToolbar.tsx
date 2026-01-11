import { markdownCommands, MarkdownCommand } from '../../utils/markdown-commands'
import * as monaco from 'monaco-editor'
import './toolbar.css'

interface MarkdownToolbarProps {
  editorRef?: React.RefObject<monaco.editor.IStandaloneCodeEditor>
}

interface ToolbarButton {
  command: MarkdownCommand
  label: string
  title: string
  icon?: string
}

const toolbarButtons: ToolbarButton[] = [
  { command: 'bold', label: 'B', title: 'Bold (Ctrl+B)', icon: '𝐁' },
  { command: 'italic', label: 'I', title: 'Italic (Ctrl+I)', icon: '𝐼' },
  { command: 'strikethrough', label: 'S', title: 'Strikethrough', icon: 'S̶' },
  { command: 'inlineCode', label: '</>', title: 'Inline Code (Ctrl+`)', icon: '</>' },
  { command: 'link', label: '🔗', title: 'Link (Ctrl+K)' },
  { command: 'image', label: '🖼', title: 'Image' },
  { command: 'codeBlock', label: '{ }', title: 'Code Block' },
  { command: 'bulletList', label: '•', title: 'Bullet List' },
  { command: 'numberedList', label: '1.', title: 'Numbered List' },
  { command: 'taskList', label: '☑', title: 'Task List' },
  { command: 'blockquote', label: '❝', title: 'Blockquote' },
  { command: 'horizontalRule', label: '—', title: 'Horizontal Rule' },
  { command: 'table', label: '⊞', title: 'Table' }
]

const headingButtons: ToolbarButton[] = [
  { command: 'heading1', label: 'H1', title: 'Heading 1' },
  { command: 'heading2', label: 'H2', title: 'Heading 2' },
  { command: 'heading3', label: 'H3', title: 'Heading 3' },
  { command: 'heading4', label: 'H4', title: 'Heading 4' },
  { command: 'heading5', label: 'H5', title: 'Heading 5' },
  { command: 'heading6', label: 'H6', title: 'Heading 6' }
]

export function MarkdownToolbar({ editorRef }: MarkdownToolbarProps) {
  const executeCommand = (command: MarkdownCommand) => {
    if (!editorRef?.current) return
    markdownCommands[command](editorRef.current)
    editorRef.current.focus()
  }

  return (
    <div className="markdown-toolbar">
      <div className="toolbar-group">
        <select
          className="toolbar-select"
          onChange={(e) => {
            const command = e.target.value as MarkdownCommand
            if (command) {
              executeCommand(command)
              e.target.value = '' // Reset selection
            }
          }}
          defaultValue=""
        >
          <option value="">Heading</option>
          {headingButtons.map((btn) => (
            <option key={btn.command} value={btn.command}>
              {btn.label}
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar-separator"></div>

      {toolbarButtons.slice(0, 4).map((btn) => (
        <button
          key={btn.command}
          className="toolbar-button"
          onClick={() => executeCommand(btn.command)}
          title={btn.title}
        >
          {btn.icon || btn.label}
        </button>
      ))}

      <div className="toolbar-separator"></div>

      {toolbarButtons.slice(4, 7).map((btn) => (
        <button
          key={btn.command}
          className="toolbar-button"
          onClick={() => executeCommand(btn.command)}
          title={btn.title}
        >
          {btn.icon || btn.label}
        </button>
      ))}

      <div className="toolbar-separator"></div>

      {toolbarButtons.slice(7).map((btn) => (
        <button
          key={btn.command}
          className="toolbar-button"
          onClick={() => executeCommand(btn.command)}
          title={btn.title}
        >
          {btn.icon || btn.label}
        </button>
      ))}
    </div>
  )
}
