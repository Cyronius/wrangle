import * as monaco from 'monaco-editor'
import { isMarkdownFile as isMarkdownFilePath } from '../utils/file-type'
import { floatingToolbarBus } from '../components/UI/floating-toolbar-bus'
import {
  setViewMode,
  togglePreviewSync,
  toggleOutline,
  toggleExplorer,
  toggleToolbar
} from '../store/layoutSlice'
import { nextTab, previousTab, closeTabsToLeft, closeTabsToRight, closeTabsByWorkspace } from '../store/tabsSlice'
import { setActiveWorkspace } from '../store/workspacesSlice'
import { setCurrentTheme, setVimMode, saveEditorSettings } from '../store/settingsSlice'

export type CommandCategory = 'file' | 'edit' | 'view' | 'navigation' | 'markdown' | 'app'

export interface CommandDefinition {
  id: string
  label: string
  category: CommandCategory
  defaultBinding: string | null
  execute: (context: CommandContext) => void
  /**
   * Shape constraints for this command's binding. Absent = standard chord.
   * When `suffix` is set, the user-editable portion is the modifier key only;
   * the suffix is a fixed mouse/tap action implied by the command.
   */
  bindingShape?: {
    suffix?: 'Scroll' | 'Drag' | 'Tap'
  }
}

export interface CommandContext {
  editor: monaco.editor.IStandaloneCodeEditor | null
  dispatch: (action: unknown) => void
  getState: () => unknown
  previewSelection?: { start: number; end: number } | null
  targetTabId?: string
  handlers: {
    onFileNew: () => void
    onFileOpen: () => void
    onFileSave: () => void
    onFileSaveAs: () => void
    onCloseTab: () => void
    onEditUndo: () => void
    onEditRedo: () => void
    onOpenPreferences: () => void
    onOpenFolder: () => void
    onOpenCommandPalette: () => void
  }
}

type ViewState = {
  tabs: { tabs: { id: string; path?: string }[]; activeTabIdByWorkspace: Record<string, string> }
  workspaces: { workspaces: { id: string; rootPath: string | null }[]; activeWorkspaceId: string }
}

function isActiveFileMarkdown(ctx: CommandContext): boolean {
  const state = ctx.getState() as ViewState
  const workspaceId = state.workspaces.activeWorkspaceId
  const activeTabId = state.tabs.activeTabIdByWorkspace[workspaceId]
  const tab = state.tabs.tabs.find(t => t.id === activeTabId)
  return isMarkdownFilePath(tab?.path)
}

function dispatchViewMode(ctx: CommandContext, mode: 'editor-only' | 'split' | 'preview-only'): void {
  ctx.dispatch(setViewMode(mode))
}

// Cycle the active workspace through the sidebar order. The default
// workspace is skipped when it has no tabs (it isn't shown in the sidebar).
function cycleWorkspace(ctx: CommandContext, direction: 1 | -1): void {
  const state = ctx.getState() as {
    workspaces: { workspaces: { id: string; rootPath: string | null }[]; activeWorkspaceId: string }
    tabs: { tabs: { workspaceId: string }[] }
  }
  const { workspaces, activeWorkspaceId } = state.workspaces
  const defaultHasTabs = state.tabs.tabs.some(t => {
    const ws = workspaces.find(w => w.id === t.workspaceId)
    return ws ? !ws.rootPath : false
  })
  const cycleIds = workspaces
    .filter(w => w.rootPath || defaultHasTabs)
    .map(w => w.id)
  if (cycleIds.length < 2) return

  const currentIndex = cycleIds.indexOf(activeWorkspaceId)
  const nextIndex = (currentIndex + direction + cycleIds.length) % cycleIds.length
  ctx.dispatch(setActiveWorkspace(cycleIds[nextIndex]))
}

// Apply preview selection to editor (for WYSIWYG editing)
function applyPreviewSelection(
  editor: monaco.editor.IStandaloneCodeEditor,
  previewSelection: { start: number; end: number } | null | undefined
): void {
  if (!previewSelection) return
  const model = editor.getModel()
  if (!model) return
  const startPos = model.getPositionAt(previewSelection.start)
  const endPos = model.getPositionAt(previewSelection.end)
  editor.setSelection(new monaco.Selection(
    startPos.lineNumber, startPos.column,
    endPos.lineNumber, endPos.column
  ))
}

// Markdown command helper - applies formatting to selection
function applyMarkdownFormat(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  prefix: string,
  suffix: string = prefix,
  previewSelection?: { start: number; end: number } | null
): void {
  if (!editor) return

  // Apply preview selection first if available (WYSIWYG)
  applyPreviewSelection(editor, previewSelection)

  const selection = editor.getSelection()
  if (!selection) return

  const model = editor.getModel()
  if (!model) return

  const selectedText = model.getValueInRange(selection)
  const newText = `${prefix}${selectedText}${suffix}`

  editor.executeEdits('', [{ range: selection, text: newText }])

  // Position cursor appropriately
  if (selectedText) {
    // Keep selection around the text
    editor.setSelection(new monaco.Selection(
      selection.startLineNumber,
      selection.startColumn + prefix.length,
      selection.endLineNumber,
      selection.endColumn + prefix.length
    ))
  } else {
    // Place cursor between the markers
    const newPos = new monaco.Position(
      selection.startLineNumber,
      selection.startColumn + prefix.length
    )
    editor.setPosition(newPos)
  }
  editor.focus()
}

// Insert text at cursor position
function insertText(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  text: string,
  cursorOffset: number = text.length,
  previewSelection?: { start: number; end: number } | null
): void {
  if (!editor) return

  // Apply preview selection first if available (WYSIWYG)
  applyPreviewSelection(editor, previewSelection)

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
  prefix: string,
  previewSelection?: { start: number; end: number } | null
): void {
  if (!editor) return

  // Apply preview selection first if available (WYSIWYG)
  applyPreviewSelection(editor, previewSelection)

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
    execute: (ctx) => dispatchViewMode(ctx, 'editor-only')
  },
  {
    id: 'view.split',
    label: 'Split View',
    category: 'view',
    defaultBinding: 'Ctrl+2',
    execute: (ctx) => {
      if (!isActiveFileMarkdown(ctx)) return
      dispatchViewMode(ctx, 'split')
    }
  },
  {
    id: 'view.previewOnly',
    label: 'Preview Only',
    category: 'view',
    defaultBinding: 'Ctrl+3',
    execute: (ctx) => {
      if (!isActiveFileMarkdown(ctx)) return
      dispatchViewMode(ctx, 'preview-only')
    }
  },
  {
    id: 'view.toggleSync',
    label: 'Toggle Preview Sync',
    category: 'view',
    defaultBinding: 'Ctrl+Shift+Y',
    execute: (ctx) => {
      ctx.dispatch(togglePreviewSync())
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

  {
    id: 'view.outline',
    label: 'Toggle Outline',
    category: 'view',
    defaultBinding: 'Ctrl+Shift+O',
    execute: (ctx) => {
      ctx.dispatch(toggleOutline())
    }
  },
  {
    id: 'view.explorer',
    label: 'Toggle Explorer',
    category: 'view',
    defaultBinding: 'Ctrl+Shift+E',
    execute: (ctx) => {
      ctx.dispatch(toggleExplorer())
    }
  },
  {
    id: 'view.toolbar',
    label: 'Toggle Toolbar',
    category: 'view',
    defaultBinding: 'Ctrl+Shift+T',
    execute: (ctx) => {
      ctx.dispatch(toggleToolbar())
    }
  },
  {
    id: 'view.zoomScroll',
    label: 'Zoom (Mouse Wheel)',
    category: 'view',
    defaultBinding: 'Ctrl',
    bindingShape: { suffix: 'Scroll' },
    execute: () => {}
  },
  {
    id: 'view.moveWindow',
    label: 'Move Window (Drag)',
    category: 'view',
    defaultBinding: 'Alt',
    bindingShape: { suffix: 'Drag' },
    execute: () => {}
  },
  {
    id: 'view.reload',
    label: 'Reload',
    category: 'view',
    defaultBinding: 'Ctrl+R',
    execute: () => window.electron.window.reload()
  },
  {
    id: 'view.forceReload',
    label: 'Force Reload',
    category: 'view',
    defaultBinding: 'Ctrl+Shift+R',
    execute: () => window.electron.window.forceReload()
  },
  {
    id: 'view.toggleFullscreen',
    label: 'Toggle Fullscreen',
    category: 'view',
    defaultBinding: 'F11',
    execute: () => window.electron.window.toggleFullscreen()
  },

  // Navigation commands
  {
    id: 'nav.nextTab',
    label: 'Next Tab',
    category: 'navigation',
    defaultBinding: 'Ctrl+PageDown',
    execute: (ctx) => {
      const state = ctx.getState() as ViewState
      const workspaceId = state.workspaces.activeWorkspaceId
      ctx.dispatch(nextTab(workspaceId))
    }
  },
  {
    id: 'nav.prevTab',
    label: 'Previous Tab',
    category: 'navigation',
    defaultBinding: 'Ctrl+PageUp',
    execute: (ctx) => {
      const state = ctx.getState() as ViewState
      const workspaceId = state.workspaces.activeWorkspaceId
      ctx.dispatch(previousTab(workspaceId))
    }
  },

  // Markdown formatting commands
  {
    id: 'markdown.openFormatToolbar',
    label: 'Open Format Toolbar at Cursor',
    category: 'markdown',
    defaultBinding: 'Alt',
    bindingShape: { suffix: 'Tap' },
    execute: () => floatingToolbarBus.openAtCursor()
  },
  {
    id: 'markdown.bold',
    label: 'Bold',
    category: 'markdown',
    defaultBinding: 'Ctrl+B',
    execute: (ctx) => applyMarkdownFormat(ctx.editor, '**', '**', ctx.previewSelection)
  },
  {
    id: 'markdown.italic',
    label: 'Italic',
    category: 'markdown',
    defaultBinding: 'Ctrl+I',
    execute: (ctx) => applyMarkdownFormat(ctx.editor, '*', '*', ctx.previewSelection)
  },
  {
    id: 'markdown.strikethrough',
    label: 'Strikethrough',
    category: 'markdown',
    defaultBinding: 'Ctrl+Shift+X',
    execute: (ctx) => applyMarkdownFormat(ctx.editor, '~~', '~~', ctx.previewSelection)
  },
  {
    id: 'markdown.code',
    label: 'Inline Code',
    category: 'markdown',
    defaultBinding: 'Ctrl+`',
    execute: (ctx) => applyMarkdownFormat(ctx.editor, '`', '`', ctx.previewSelection)
  },
  {
    id: 'markdown.link',
    label: 'Insert Link',
    category: 'markdown',
    defaultBinding: 'Ctrl+K',
    execute: (ctx) => {
      if (!ctx.editor) return
      // Apply preview selection first if available (WYSIWYG)
      applyPreviewSelection(ctx.editor, ctx.previewSelection)
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
    defaultBinding: null,
    execute: (ctx) => {
      const table = `| Header 1 | Header 2 | Header 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
`
      insertText(ctx.editor, table, 2, ctx.previewSelection)
    }
  },
  {
    id: 'markdown.heading1',
    label: 'Heading 1',
    category: 'markdown',
    defaultBinding: 'Ctrl+Alt+1',
    execute: (ctx) => applyLinePrefix(ctx.editor, '# ', ctx.previewSelection)
  },
  {
    id: 'markdown.heading2',
    label: 'Heading 2',
    category: 'markdown',
    defaultBinding: 'Ctrl+Alt+2',
    execute: (ctx) => applyLinePrefix(ctx.editor, '## ', ctx.previewSelection)
  },
  {
    id: 'markdown.heading3',
    label: 'Heading 3',
    category: 'markdown',
    defaultBinding: 'Ctrl+Alt+3',
    execute: (ctx) => applyLinePrefix(ctx.editor, '### ', ctx.previewSelection)
  },
  {
    id: 'markdown.heading4',
    label: 'Heading 4',
    category: 'markdown',
    defaultBinding: 'Ctrl+Alt+4',
    execute: (ctx) => applyLinePrefix(ctx.editor, '#### ', ctx.previewSelection)
  },
  {
    id: 'markdown.heading5',
    label: 'Heading 5',
    category: 'markdown',
    defaultBinding: 'Ctrl+Alt+5',
    execute: (ctx) => applyLinePrefix(ctx.editor, '##### ', ctx.previewSelection)
  },
  {
    id: 'markdown.heading6',
    label: 'Heading 6',
    category: 'markdown',
    defaultBinding: 'Ctrl+Alt+6',
    execute: (ctx) => applyLinePrefix(ctx.editor, '###### ', ctx.previewSelection)
  },
  {
    id: 'markdown.bulletList',
    label: 'Bullet List',
    category: 'markdown',
    defaultBinding: 'Ctrl+Shift+8',
    execute: (ctx) => applyLinePrefix(ctx.editor, '- ', ctx.previewSelection)
  },
  {
    id: 'markdown.numberedList',
    label: 'Numbered List',
    category: 'markdown',
    defaultBinding: 'Ctrl+Shift+7',
    execute: (ctx) => applyLinePrefix(ctx.editor, '1. ', ctx.previewSelection)
  },
  {
    id: 'markdown.taskList',
    label: 'Task List',
    category: 'markdown',
    defaultBinding: 'Ctrl+Shift+9',
    execute: (ctx) => applyLinePrefix(ctx.editor, '- [ ] ', ctx.previewSelection)
  },
  {
    id: 'markdown.blockquote',
    label: 'Blockquote',
    category: 'markdown',
    defaultBinding: 'Ctrl+Shift+.',
    execute: (ctx) => applyLinePrefix(ctx.editor, '> ', ctx.previewSelection)
  },
  {
    id: 'markdown.codeBlock',
    label: 'Code Block',
    category: 'markdown',
    defaultBinding: 'Ctrl+Shift+`',
    execute: (ctx) => {
      if (!ctx.editor) return
      // Apply preview selection first if available (WYSIWYG)
      applyPreviewSelection(ctx.editor, ctx.previewSelection)
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
    execute: (ctx) => insertText(ctx.editor, '![alt text](image-url)', 2, ctx.previewSelection)
  },
  {
    id: 'markdown.hr',
    label: 'Horizontal Rule',
    category: 'markdown',
    defaultBinding: null,
    execute: (ctx) => insertText(ctx.editor, '\n---\n', undefined, ctx.previewSelection)
  },

  // Theme commands
  {
    id: 'view.themeLight',
    label: 'Light Theme',
    category: 'view',
    defaultBinding: null,
    execute: (ctx) => {
      ctx.dispatch(setCurrentTheme('light'))
    }
  },
  {
    id: 'view.themeDark',
    label: 'Dark Theme',
    category: 'view',
    defaultBinding: null,
    execute: (ctx) => {
      ctx.dispatch(setCurrentTheme('Dark'))
    }
  },
  // Workspace commands
  {
    id: 'workspace.openFolder',
    label: 'Open Folder as Workspace...',
    category: 'navigation',
    defaultBinding: 'Ctrl+K Ctrl+O',
    execute: (ctx) => ctx.handlers.onOpenFolder()
  },

  // Workspace navigation
  {
    id: 'nav.nextWorkspace',
    label: 'Next Workspace',
    category: 'navigation',
    defaultBinding: 'Ctrl+Shift+PageDown',
    execute: (ctx) => cycleWorkspace(ctx, 1)
  },
  {
    id: 'nav.prevWorkspace',
    label: 'Previous Workspace',
    category: 'navigation',
    defaultBinding: 'Ctrl+Shift+PageUp',
    execute: (ctx) => cycleWorkspace(ctx, -1)
  },

  // App commands
  {
    id: 'app.commandPalette',
    label: 'Command Palette',
    category: 'app',
    defaultBinding: 'Ctrl+Shift+P',
    execute: (ctx) => ctx.handlers.onOpenCommandPalette()
  },
  {
    id: 'app.preferences',
    label: 'Preferences',
    category: 'app',
    defaultBinding: 'Ctrl+,',
    execute: (ctx) => ctx.handlers.onOpenPreferences()
  },
  {
    id: 'app.exit',
    label: 'Exit',
    category: 'app',
    defaultBinding: 'Ctrl+Q',
    execute: () => window.electron.window.close()
  },
  {
    id: 'editor.toggleVimMode',
    label: 'Toggle Vim Mode',
    category: 'edit',
    defaultBinding: null,
    execute: (ctx) => {
      const state = ctx.getState() as { settings: { editor: { vimMode: boolean } } }
      const current = state.settings?.editor?.vimMode ?? false
      ctx.dispatch(setVimMode(!current))
      ctx.dispatch(saveEditorSettings())
    }
  },

  // Tab context menu commands
  {
    id: 'tab.revealInExplorer',
    label: 'Reveal in File Explorer',
    category: 'file',
    defaultBinding: null,
    execute: (ctx) => {
      const state = ctx.getState() as { tabs: { tabs: { id: string; path?: string }[] } }
      const tabId = ctx.targetTabId
      if (!tabId) return
      const tab = state.tabs.tabs.find(t => t.id === tabId)
      if (tab?.path) {
        window.electron.shell.showItemInFolder(tab.path)
      }
    }
  },
  {
    id: 'tab.copyPath',
    label: 'Copy Path',
    category: 'file',
    defaultBinding: null,
    execute: (ctx) => {
      const state = ctx.getState() as { tabs: { tabs: { id: string; path?: string }[] } }
      const tabId = ctx.targetTabId
      if (!tabId) return
      const tab = state.tabs.tabs.find(t => t.id === tabId)
      if (tab?.path) {
        navigator.clipboard.writeText(tab.path)
      }
    }
  },
  {
    id: 'tab.copyRelativePath',
    label: 'Copy Relative Path',
    category: 'file',
    defaultBinding: null,
    execute: (ctx) => {
      const state = ctx.getState() as {
        tabs: { tabs: { id: string; path?: string; workspaceId: string; filename: string }[] }
        workspaces: { workspaces: { id: string; rootPath: string | null }[] }
      }
      const tabId = ctx.targetTabId
      if (!tabId) return
      const tab = state.tabs.tabs.find(t => t.id === tabId)
      if (!tab?.path) return
      const workspace = state.workspaces.workspaces.find(w => w.id === tab.workspaceId)
      if (workspace?.rootPath) {
        const normalized = tab.path.replace(/\\/g, '/')
        const normalizedRoot = workspace.rootPath.replace(/\\/g, '/')
        const prefix = normalizedRoot.endsWith('/') ? normalizedRoot : normalizedRoot + '/'
        const relative = normalized.startsWith(prefix)
          ? normalized.slice(prefix.length)
          : tab.path
        navigator.clipboard.writeText(relative)
      } else {
        navigator.clipboard.writeText(tab.filename)
      }
    }
  },
  {
    id: 'tab.closeToLeft',
    label: 'Close Tabs to Left',
    category: 'navigation',
    defaultBinding: null,
    execute: (ctx) => {
      const tabId = ctx.targetTabId
      if (tabId) {
        ctx.dispatch(closeTabsToLeft(tabId))
      }
    }
  },
  {
    id: 'tab.closeToRight',
    label: 'Close Tabs to Right',
    category: 'navigation',
    defaultBinding: null,
    execute: (ctx) => {
      const tabId = ctx.targetTabId
      if (tabId) {
        ctx.dispatch(closeTabsToRight(tabId))
      }
    }
  },
  {
    id: 'tab.closeAll',
    label: 'Close All Tabs',
    category: 'navigation',
    defaultBinding: null,
    execute: (ctx) => {
      const state = ctx.getState() as {
        tabs: { tabs: { id: string; workspaceId: string }[] }
        workspaces: { activeWorkspaceId: string }
      }
      const tabId = ctx.targetTabId
      const tab = tabId ? state.tabs.tabs.find(t => t.id === tabId) : null
      const workspaceId = tab?.workspaceId ?? state.workspaces.activeWorkspaceId
      ctx.dispatch(closeTabsByWorkspace(workspaceId))
    }
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
