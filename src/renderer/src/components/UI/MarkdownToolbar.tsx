import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { markdownCommands, MarkdownCommand } from '../../utils/markdown-commands'
import { RootState } from '../../store/store'
import { setViewMode, ViewMode } from '../../store/layoutSlice'
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

// SVG Icons for view mode buttons
const EditorIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5z"/>
  </svg>
)

const SplitIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M0 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3zm8.5-1v12H14a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H8.5zm-1 0H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h5.5V2z"/>
  </svg>
)

const PreviewIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
  </svg>
)

interface ViewModeButton {
  mode: ViewMode
  label: string
  title: string
  icon: React.ReactNode
}

const viewModeButtons: ViewModeButton[] = [
  { mode: 'editor-only', label: 'Editor', title: 'Editor Only (Ctrl+1)', icon: <EditorIcon /> },
  { mode: 'split', label: 'Split', title: 'Split View (Ctrl+2)', icon: <SplitIcon /> },
  { mode: 'preview-only', label: 'Preview', title: 'Preview Only (Ctrl+3)', icon: <PreviewIcon /> }
]

export function MarkdownToolbar({ editorRef }: MarkdownToolbarProps) {
  const dispatch = useDispatch()
  const viewMode = useSelector((state: RootState) => state.layout.mode)
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set())

  // Track cursor position and detect active formatting
  useEffect(() => {
    if (!editorRef?.current) return
    const editor = editorRef.current

    const updateActiveFormats = () => {
      const selection = editor.getSelection()
      const model = editor.getModel()
      if (!selection || !model) return

      const lineContent = model.getLineContent(selection.startLineNumber)
      const active = new Set<string>()

      // Check line-start formatting (headings, lists, etc.)
      // Check headings from most specific to least (h6 → h1) to avoid false matches
      if (/^######\s/.test(lineContent)) active.add('heading6')
      else if (/^#####\s/.test(lineContent)) active.add('heading5')
      else if (/^####\s/.test(lineContent)) active.add('heading4')
      else if (/^###\s/.test(lineContent)) active.add('heading3')
      else if (/^##\s/.test(lineContent)) active.add('heading2')
      else if (/^#\s/.test(lineContent)) active.add('heading1')
      if (/^-\s(?!\[)/.test(lineContent)) active.add('bulletList')
      if (/^\d+\.\s/.test(lineContent)) active.add('numberedList')
      if (/^-\s\[[ x]\]\s/.test(lineContent)) active.add('taskList')
      if (/^>\s/.test(lineContent)) active.add('blockquote')

      // Check for inline formatting by analyzing text around cursor
      const colStart = selection.startColumn
      const colEnd = selection.endColumn
      const beforeCursor = lineContent.substring(0, colStart - 1)
      const afterCursor = lineContent.substring(colEnd - 1)

      // Bold: check if cursor is within **...**
      const boldBeforeMatches = (beforeCursor.match(/\*\*/g) || []).length
      const boldAfterMatches = (afterCursor.match(/\*\*/g) || []).length
      if (boldBeforeMatches % 2 === 1 && boldAfterMatches >= 1) {
        active.add('bold')
      }

      // Italic: check for single * (but not **)
      // This is tricky because * is used for both bold and italic
      const italicPattern = /(?<!\*)\*(?!\*)/g
      const italicBeforeMatches = (beforeCursor.match(italicPattern) || []).length
      const italicAfterMatches = (afterCursor.match(italicPattern) || []).length
      if (italicBeforeMatches % 2 === 1 && italicAfterMatches >= 1) {
        active.add('italic')
      }

      // Strikethrough: ~~...~~
      const strikeBeforeMatches = (beforeCursor.match(/~~/g) || []).length
      const strikeAfterMatches = (afterCursor.match(/~~/g) || []).length
      if (strikeBeforeMatches % 2 === 1 && strikeAfterMatches >= 1) {
        active.add('strikethrough')
      }

      // Inline code: `...`
      const codeBeforeMatches = (beforeCursor.match(/`/g) || []).length
      const codeAfterMatches = (afterCursor.match(/`/g) || []).length
      if (codeBeforeMatches % 2 === 1 && codeAfterMatches >= 1) {
        active.add('inlineCode')
      }

      // Table: line contains |
      if (lineContent.includes('|')) active.add('table')

      // Link: cursor is within [...](...) pattern
      if (/\[.*?\]\(.*?\)/.test(lineContent)) {
        // Check if cursor is inside a link
        const linkPattern = /\[([^\]]*)\]\(([^)]*)\)/g
        let match
        while ((match = linkPattern.exec(lineContent)) !== null) {
          const start = match.index
          const end = start + match[0].length
          if (colStart > start && colStart <= end + 1) {
            active.add('link')
            break
          }
        }
      }

      // Code block: check if we're within ``` markers
      const fullText = model.getValue()
      const offset = model.getOffsetAt(selection.getStartPosition())
      const textBefore = fullText.substring(0, offset)
      const codeBlockMatches = (textBefore.match(/```/g) || []).length
      if (codeBlockMatches % 2 === 1) {
        active.add('codeBlock')
      }

      setActiveFormats(active)
    }

    // Listen to cursor position and selection changes
    const disposables = [
      editor.onDidChangeCursorPosition(updateActiveFormats),
      editor.onDidChangeCursorSelection(updateActiveFormats)
    ]
    updateActiveFormats() // Initial check

    return () => disposables.forEach(d => d.dispose())
  }, [editorRef?.current])

  const executeCommand = (command: MarkdownCommand) => {
    if (!editorRef?.current) return
    markdownCommands[command](editorRef.current)
    editorRef.current.focus()
  }

  return (
    <div className="markdown-toolbar">
      <div className="toolbar-group heading-group">
        {headingButtons.map((btn) => (
          <button
            key={btn.command}
            className={`toolbar-button heading-button ${activeFormats.has(btn.command) ? 'active' : ''}`}
            onClick={() => executeCommand(btn.command)}
            title={btn.title}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="toolbar-separator"></div>

      {toolbarButtons.slice(0, 4).map((btn) => (
        <button
          key={btn.command}
          className={`toolbar-button ${activeFormats.has(btn.command) ? 'active' : ''}`}
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
          className={`toolbar-button ${activeFormats.has(btn.command) ? 'active' : ''}`}
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
          className={`toolbar-button ${activeFormats.has(btn.command) ? 'active' : ''}`}
          onClick={() => executeCommand(btn.command)}
          title={btn.title}
        >
          {btn.icon || btn.label}
        </button>
      ))}

      <div className="toolbar-separator"></div>

      <div className="toolbar-group view-mode-group">
        {viewModeButtons.map((btn) => (
          <button
            key={btn.mode}
            className={`toolbar-button view-mode-button ${viewMode === btn.mode ? 'active' : ''}`}
            onClick={() => dispatch(setViewMode(btn.mode))}
            title={btn.title}
          >
            {btn.icon}
          </button>
        ))}
      </div>
    </div>
  )
}
