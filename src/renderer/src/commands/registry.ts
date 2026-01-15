import * as monaco from 'monaco-editor'
import { markdownCommands } from '../utils/markdown-commands'

export type CommandCategory = 'file' | 'edit' | 'view' | 'navigation' | 'markdown' | 'app'

export interface CommandDefinition {
  id: string
  label: string
  category: CommandCategory
  defaultBinding: string | null
  execute: (context: CommandContext) => void
}

export interface CommandContext {
  editor: monaco.editor.IStandaloneCodeEditor | null
  dispatch: (action: unknown) => void
  getState: () => unknown
  handlers: {
    onFileNew: () => void
    onFileOpen: () => void
    onFileSave: () => void
    onFileSaveAs: () => void
    onCloseTab: () => void
    onEditUndo: () => void
    onEditRedo: () => void
    onOpenPreferences: () => void
  }
}

// Insert text at cursor position
function insertText(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  text: string,
  cursorOffset: number = text.length
): void {
  if (!editor) return
  const selection = editor.getSelection()
  if (!selection) return

  const position = selection.getStartPosition()
  const range = new monaco.Range(
    position.lineNumber,
    position.column,
    position.lineNumber,
    position.column
  )

  editor.executeEdits('', [{ range, text }])

  // Position cursor
  const lines = text.split('\n')
  let newLine = position.lineNumber
  let newColumn = position.column

  if (lines.length === 1) {
    newColumn += cursorOffset
  } else {
    newLine += lines.length - 1
    newColumn = lines[lines.length - 1].length + 1
  }

  editor.setPosition(new monaco.Position(newLine, newColumn))
  editor.focus()
}

// Apply line prefix to current line or selected lines
function applyLinePrefix(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  prefix: string
): void {
  if (!editor) return
  const selection = editor.getSelection()
  if (!selection) return

  const model = editor.getModel()
  if (!model) return

  const startLine = selection.startLineNumber
  const endLine = selection.endLineNumber

  const edits: monaco.editor.IIdentifiedSingleEditOperation[] = []

  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const lineContent = model.getLineContent(lineNum)
    const range = new monaco.Range(lineNum, 1, lineNum, lineContent.length + 1)
    edits.push({ range, text: prefix + lineContent })
  }

  editor.executeEdits('', edits)
  editor.focus()
}

// All command definitions
export const commands: CommandDefinition[] = [
  // File commands
  {
    id: 'file.new',
    label: 'New File',
    category: 'file',
    defaultBinding: 'Ctrl+N',
    execute: (ctx) => ctx.handlers.onFileNew()
  },
  {
    id: 'file.open',
    label: 'Open File',
    category: 'file',
    defaultBinding: 'Ctrl+O',
    execute: (ctx) => ctx.handlers.onFileOpen()
  },
  {
    id: 'file.save',
    label: 'Save',
    category: 'file',
    defaultBinding: 'Ctrl+S',
    execute: (ctx) => ctx.handlers.onFileSave()
  },
  {
    id: 'file.saveAs',
    label: 'Save As',
    category: 'file',
    defaultBinding: 'Ctrl+Shift+S',
    execute: (ctx) => ctx.handlers.onFileSaveAs()
  },
  {
    id: 'file.close',
    label: 'Close Tab',
    category: 'file',
    defaultBinding: 'Ctrl+W',
    execute: (ctx) => ctx.handlers.onCloseTab()
  },
  {
    id: 'file.print',
    label: 'Print',
    category: 'file',
    defaultBinding: 'Ctrl+P',
    execute: () => window.electron.window.print()
  },

  // Edit commands
  {
    id: 'edit.undo',
    label: 'Undo',
    category: 'edit',
    defaultBinding: 'Ctrl+Z',
    execute: (ctx) => ctx.handlers.onEditUndo()
  },
  {
    id: 'edit.redo',
    label: 'Redo',
    category: 'edit',
    defaultBinding: 'Ctrl+Y',
    execute: (ctx) => ctx.handlers.onEditRedo()
  },
  {
    id: 'edit.cut',
    label: 'Cut',
    category: 'edit',
    defaultBinding: 'Ctrl+X',
    execute: () => document.execCommand('cut')
  },
  {
    id: 'edit.copy',
    label: 'Copy',
    category: 'edit',
    defaultBinding: 'Ctrl+C',
    execute: () => document.execCommand('copy')
  },
  {
    id: 'edit.paste',
    label: 'Paste',
    category: 'edit',
    defaultBinding: 'Ctrl+V',
    execute: () => document.execCommand('paste')
  },
  {
    id: 'edit.selectAll',
    label: 'Select All',
    category: 'edit',
    defaultBinding: 'Ctrl+A',
    execute: () => document.execCommand('selectAll')
  },
  {
    id: 'edit.toggleCase',
    label: 'Toggle Case',
    category: 'edit',
    defaultBinding: 'Ctrl+Shift+U',
    execute: (ctx) => {
      if (!ctx.editor) return
      const selection = ctx.editor.getSelection()
      const text = ctx.editor.getModel()?.getValueInRange(selection!)
      if (text && selection) {
        const isUppercase = text === text.toUpperCase() && text !== text.toLowerCase()
        ctx.editor.executeEdits('', [{
          range: selection,
          text: isUppercase ? text.toLowerCase() : text.toUpperCase()
        }])
      }
    }
  },
  {
    id: 'edit.lowercase',
    label: 'Convert to Lowercase',
    category: 'edit',
    defaultBinding: 'Ctrl+Shift+L',
    execute: (ctx) => {
      if (!ctx.editor) return
      const selection = ctx.editor.getSelection()
      const text = ctx.editor.getModel()?.getValueInRange(selection!)
      if (text && selection) {
        ctx.editor.executeEdits('', [{
          range: selection,
          text: text.toLowerCase()
        }])
      }
    }
  },

  // View commands
  {
    id: 'view.editorOnly',
    label: 'Editor Only',
    category: 'view',
    defaultBinding: 'Ctrl+1',
    execute: (ctx) => {
      const { setViewMode } = require('../store/layoutSlice')
      ctx.dispatch(setViewMode('editor-only'))
    }
  },
  {
    id: 'view.split',
    label: 'Split View',
    category: 'view',
    defaultBinding: 'Ctrl+2',
    execute: (ctx) => {
      const { setViewMode } = require('../store/layoutSlice')
      ctx.dispatch(setViewMode('split'))
    }
  },
  {
    id: 'view.previewOnly',
    label: 'Preview Only',
    category: 'view',
    defaultBinding: 'Ctrl+3',
    execute: (ctx) => {
      const { setViewMode } = require('../store/layoutSlice')
      ctx.dispatch(setViewMode('preview-only'))
    }
  },
  {
    id: 'view.zoomIn',
    label: 'Zoom In',
    category: 'view',
    defaultBinding: 'Ctrl+=',
    execute: () => window.electron.window.zoom(1)
  },
  {
    id: 'view.zoomOut',
    label: 'Zoom Out',
    category: 'view',
    defaultBinding: 'Ctrl+-',
    execute: () => window.electron.window.zoom(-1)
  },
  {
    id: 'view.resetZoom',
    label: 'Reset Zoom',
    category: 'view',
    defaultBinding: 'Ctrl+0',
    execute: () => window.electron.window.resetZoom()
  },
  {
    id: 'view.devTools',
    label: 'Developer Tools',
    category: 'view',
    defaultBinding: 'F12',
    execute: () => window.electron.window.toggleDevTools()
  },

  // Navigation commands
  {
    id: 'nav.nextTab',
    label: 'Next Tab',
    category: 'navigation',
    defaultBinding: 'Ctrl+PageDown',
    execute: (ctx) => {
      const { nextTab } = require('../store/tabsSlice')
      ctx.dispatch(nextTab())
    }
  },
  {
    id: 'nav.prevTab',
    label: 'Previous Tab',
    category: 'navigation',
    defaultBinding: 'Ctrl+PageUp',
    execute: (ctx) => {
      const { previousTab } = require('../store/tabsSlice')
      ctx.dispatch(previousTab())
    }
  },

  // Markdown formatting commands - use unified markdownCommands for proper toggle behavior
  {
    id: 'markdown.bold',
    label: 'Bold',
    category: 'markdown',
    defaultBinding: 'Ctrl+B',
    execute: (ctx) => {
      if (ctx.editor) {
        markdownCommands.bold(ctx.editor)
        ctx.editor.focus()
      }
    }
  },
  {
    id: 'markdown.italic',
    label: 'Italic',
    category: 'markdown',
    defaultBinding: 'Ctrl+I',
    execute: (ctx) => {
      if (ctx.editor) {
        markdownCommands.italic(ctx.editor)
        ctx.editor.focus()
      }
    }
  },
  {
    id: 'markdown.strikethrough',
    label: 'Strikethrough',
    category: 'markdown',
    defaultBinding: 'Ctrl+Shift+X',
    execute: (ctx) => {
      if (ctx.editor) {
        markdownCommands.strikethrough(ctx.editor)
        ctx.editor.focus()
      }
    }
  },
  {
    id: 'markdown.code',
    label: 'Inline Code',
    category: 'markdown',
    defaultBinding: 'Ctrl+`',
    execute: (ctx) => {
      if (ctx.editor) {
        markdownCommands.inlineCode(ctx.editor)
        ctx.editor.focus()
      }
    }
  },
  {
    id: 'markdown.link',
    label: 'Insert Link',
    category: 'markdown',
    defaultBinding: 'Ctrl+K',
    execute: (ctx) => {
      if (!ctx.editor) return
      const selection = ctx.editor.getSelection()
      const text = ctx.editor.getModel()?.getValueInRange(selection!) || ''
      const linkText = text || 'link text'
      applyMarkdownFormat(ctx.editor, '[', `](url)`)
      // If no text was selected, put cursor in the text part
      if (!text && selection) {
        ctx.editor.setSelection(new monaco.Selection(
          selection.startLineNumber,
          selection.startColumn + 1,
          selection.startLineNumber,
          selection.startColumn + 1 + linkText.length
        ))
      }
    }
  },
  {
    id: 'markdown.table',
    label: 'Insert Table',
    category: 'markdown',
    defaultBinding: 'Ctrl+Shift+T',
    execute: (ctx) => {
      const table = `| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
`
      insertText(ctx.editor, table, 2)
    }
  },
  {
    id: 'markdown.heading1',
    label: 'Heading 1',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => applyLinePrefix(ctx.editor, '# ')
  },
  {
    id: 'markdown.heading2',
    label: 'Heading 2',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => applyLinePrefix(ctx.editor, '## ')
  },
  {
    id: 'markdown.heading3',
    label: 'Heading 3',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => applyLinePrefix(ctx.editor, '### ')
  },
  {
    id: 'markdown.heading4',
    label: 'Heading 4',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => applyLinePrefix(ctx.editor, '#### ')
  },
  {
    id: 'markdown.heading5',
    label: 'Heading 5',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => applyLinePrefix(ctx.editor, '##### ')
  },
  {
    id: 'markdown.heading6',
    label: 'Heading 6',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => applyLinePrefix(ctx.editor, '###### ')
  },
  {
    id: 'markdown.bulletList',
    label: 'Bullet List',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => applyLinePrefix(ctx.editor, '- ')
  },
  {
    id: 'markdown.numberedList',
    label: 'Numbered List',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => applyLinePrefix(ctx.editor, '1. ')
  },
  {
    id: 'markdown.taskList',
    label: 'Task List',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => applyLinePrefix(ctx.editor, '- [ ] ')
  },
  {
    id: 'markdown.blockquote',
    label: 'Blockquote',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => applyLinePrefix(ctx.editor, '> ')
  },
  {
    id: 'markdown.codeBlock',
    label: 'Code Block',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => {
      if (!ctx.editor) return
      const selection = ctx.editor.getSelection()
      const text = ctx.editor.getModel()?.getValueInRange(selection!) || ''
      const codeBlock = '```\n' + text + '\n```'
      if (selection) {
        ctx.editor.executeEdits('', [{ range: selection, text: codeBlock }])
        // Position cursor after first ```
        ctx.editor.setPosition(new monaco.Position(
          selection.startLineNumber,
          4
        ))
      }
      ctx.editor.focus()
    }
  },
  {
    id: 'markdown.image',
    label: 'Insert Image',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => insertText(ctx.editor, '![alt text](image-url)', 2)
  },
  {
    id: 'markdown.hr',
    label: 'Horizontal Rule',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => insertText(ctx.editor, '\n---\n')
  },

  // App commands
  {
    id: 'app.preferences',
    label: 'Preferences',
    category: 'app',
    defaultBinding: 'Ctrl+,',
    execute: (ctx) => ctx.handlers.onOpenPreferences()
  }
]

// Create a map for quick lookup
export const commandMap = new Map<string, CommandDefinition>(
  commands.map(cmd => [cmd.id, cmd])
)

// Get commands by category
export function getCommandsByCategory(category: CommandCategory): CommandDefinition[] {
  return commands.filter(cmd => cmd.category === category)
}

// Get all categories
export const categories: CommandCategory[] = ['file', 'edit', 'view', 'navigation', 'markdown', 'app']

// Category display names
export const categoryLabels: Record<CommandCategory, string> = {
  file: 'File',
  edit: 'Edit',
  view: 'View',
  navigation: 'Navigation',
  markdown: 'Markdown',
  app: 'Application'
}
