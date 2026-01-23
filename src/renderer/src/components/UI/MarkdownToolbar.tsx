import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { markdownCommands, MarkdownCommand } from '../../utils/markdown-commands'
import { RootState } from '../../store/store'
import { setViewMode, ViewMode, toggleOutline } from '../../store/layoutSlice'
import * as monaco from 'monaco-editor'
import { PenLine, Columns2, Eye, List } from 'lucide-react'
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

// Text styling buttons (Bold, Italic, Strikethrough, Inline Code)
const textStylingButtons: ToolbarButton[] = [
  { command: 'bold', label: 'B', title: 'Bold (Ctrl+B)', icon: '𝐁' },
  { command: 'italic', label: 'I', title: 'Italic (Ctrl+I)', icon: '𝐼' },
  { command: 'strikethrough', label: 'S', title: 'Strikethrough', icon: 'S̶' },
  { command: 'inlineCode', label: '</>', title: 'Inline Code (Ctrl+`)', icon: '</>' },
]

// Structure buttons (lists, blockquote, horizontal rule, table)
const structureButtons: ToolbarButton[] = [
  { command: 'bulletList', label: '•', title: 'Bullet List' },
  { command: 'numberedList', label: '1.', title: 'Numbered List' },
  { command: 'taskList', label: '☑', title: 'Task List' },
  { command: 'blockquote', label: '❝', title: 'Blockquote' },
  { command: 'horizontalRule', label: '—', title: 'Horizontal Rule' },
  { command: 'table', label: '⊞', title: 'Table' },
  { command: 'link', label: '🔗', title: 'Link (Ctrl+K)' },
  { command: 'image', label: '🖼', title: 'Image' },
  { command: 'codeBlock', label: '{ }', title: 'Code Block' },
]

const headingButtons: ToolbarButton[] = [
  { command: 'heading1', label: 'H1', title: 'Heading 1' },
  { command: 'heading2', label: 'H2', title: 'Heading 2' },
  { command: 'heading3', label: 'H3', title: 'Heading 3' },
  { command: 'heading4', label: 'H4', title: 'Heading 4' },
  { command: 'heading5', label: 'H5', title: 'Heading 5' },
  { command: 'heading6', label: 'H6', title: 'Heading 6' }
]

const iconSize = 14

interface ViewModeButton {
  mode: ViewMode
  label: string
  title: string
  icon: React.ReactNode
}

const viewModeButtons: ViewModeButton[] = [
  { mode: 'editor-only', label: 'Editor', title: 'Editor Only (Ctrl+1)', icon: <PenLine size={iconSize} /> },
  { mode: 'split', label: 'Split', title: 'Split View (Ctrl+2)', icon: <Columns2 size={iconSize} /> },
  { mode: 'preview-only', label: 'Preview', title: 'Preview Only (Ctrl+3)', icon: <Eye size={iconSize} /> }
]

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mdwn'])

function isMarkdownFile(filePath?: string): boolean {
  if (!filePath) return true // Unsaved files default to markdown
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  return MARKDOWN_EXTENSIONS.has(ext)
}

export function MarkdownToolbar({ editorRef }: MarkdownToolbarProps) {
  const dispatch = useDispatch()
  const viewMode = useSelector((state: RootState) => state.layout.viewMode)
  const showOutline = useSelector((state: RootState) => state.layout.showOutline)
  const activeTabPath = useSelector((state: RootState) => {
    const workspaceId = state.workspaces.activeWorkspaceId
    const activeTabId = state.tabs.activeTabIdByWorkspace[workspaceId]
    const tab = state.tabs.tabs.find(t => t.id === activeTabId)
    return tab?.path
  })
  const isMarkdown = isMarkdownFile(activeTabPath)
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set())

  // Force editor-only mode for non-markdown files
  useEffect(() => {
    if (!isMarkdown && viewMode !== 'editor-only') {
      dispatch(setViewMode('editor-only'))
    }
  }, [isMarkdown, viewMode, dispatch])

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
    // Focus editor before command to ensure selection is active
    editorRef.current.focus()
    markdownCommands[command](editorRef.current)
    // Return focus to preview if in preview-only mode
    if (viewMode === 'preview-only') {
      setTimeout(() => {
        editorRef.current?.getContainerDomNode()?.blur()
      }, 0)
    }
  }

  return (
    <div className="markdown-toolbar">
      {/* Text styling group: Bold, Italic, Strikethrough, Inline Code */}
      <div className="toolbar-group">
        {textStylingButtons.map((btn) => (
          <button
            key={btn.command}
            className={`toolbar-button ${activeFormats.has(btn.command) ? 'active' : ''}`}
            onClick={() => executeCommand(btn.command)}
            title={btn.title}
          >
            {btn.icon || btn.label}
          </button>
        ))}
      </div>

      {/* Headings H1-H6 */}
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

      <div className="toolbar-separator" />

      {/* Structure group: lists, blockquote, hr, table, link, image, code block */}
      <div className="toolbar-group">
        {structureButtons.map((btn) => (
          <button
            key={btn.command}
            className={`toolbar-button ${activeFormats.has(btn.command) ? 'active' : ''}`}
            onClick={() => executeCommand(btn.command)}
            title={btn.title}
          >
            {btn.icon || btn.label}
          </button>
        ))}
      </div>

      {isMarkdown && (
        <>
          <div className="toolbar-separator" />

          {/* View mode group: Editor, Split, Preview */}
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

          <div className="toolbar-separator" />

          {/* Outline toggle button */}
          <button
            className={`toolbar-button ${showOutline ? 'active' : ''}`}
            onClick={() => dispatch(toggleOutline())}
            title="Toggle Outline (Ctrl+Shift+O)"
          >
            <List size={iconSize} />
          </button>
        </>
      )}
    </div>
  )
}
