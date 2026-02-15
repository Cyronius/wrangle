import * as monaco from 'monaco-editor'

type EditorCommand = (editor: monaco.editor.IStandaloneCodeEditor) => void

/**
 * Wraps the current selection with prefix and suffix, or unwraps if already wrapped (toggle behavior)
 */
function wrapSelection(
  editor: monaco.editor.IStandaloneCodeEditor,
  prefix: string,
  suffix: string = prefix
): void {
  const selection = editor.getSelection()
  const model = editor.getModel()
  if (!selection || !model) return

  const text = model.getValueInRange(selection)
  const lineContent = model.getLineContent(selection.startLineNumber)

  // For single-line selections, check if markers are outside the selection
  if (selection.startLineNumber === selection.endLineNumber) {
    const beforeStart = selection.startColumn - 1 - prefix.length
    const afterEnd = selection.endColumn - 1

    // Check if text before selection ends with prefix and text after selection starts with suffix
    const textBefore = lineContent.substring(Math.max(0, beforeStart), selection.startColumn - 1)
    const textAfter = lineContent.substring(afterEnd, afterEnd + suffix.length)

    if (textBefore === prefix && textAfter === suffix) {
      // Remove formatting - expand range to include markers and replace with just the text
      const expandedRange = new monaco.Range(
        selection.startLineNumber,
        selection.startColumn - prefix.length,
        selection.endLineNumber,
        selection.endColumn + suffix.length
      )
      editor.executeEdits('', [
        {
          range: expandedRange,
          text: text
        }
      ])
      // Set selection to the unwrapped text
      editor.setSelection(
        new monaco.Selection(
          selection.startLineNumber,
          selection.startColumn - prefix.length,
          selection.endLineNumber,
          selection.endColumn - prefix.length
        )
      )
      return
    }
  }

  // Check if selection itself starts and ends with the markers
  if (text.startsWith(prefix) && text.endsWith(suffix) && text.length >= prefix.length + suffix.length) {
    const unwrapped = text.slice(prefix.length, text.length - suffix.length)
    editor.executeEdits('', [
      {
        range: selection,
        text: unwrapped
      }
    ])
    // Adjust selection
    editor.setSelection(
      new monaco.Selection(
        selection.startLineNumber,
        selection.startColumn,
        selection.endLineNumber,
        selection.endColumn - prefix.length - suffix.length
      )
    )
    return
  }

  // Handle empty selection (cursor only) - check if cursor is inside empty markers
  if (selection.isEmpty()) {
    const col = selection.startColumn - 1
    // Check for empty markers like ** or `` around cursor
    const potentialStart = col - prefix.length
    const potentialEnd = col + suffix.length
    if (potentialStart >= 0 && potentialEnd <= lineContent.length) {
      const around = lineContent.substring(potentialStart, potentialEnd)
      if (around === prefix + suffix) {
        // Remove empty markers
        editor.executeEdits('', [
          {
            range: new monaco.Range(
              selection.startLineNumber,
              potentialStart + 1,
              selection.startLineNumber,
              potentialEnd + 1
            ),
            text: ''
          }
        ])
        editor.setPosition(new monaco.Position(selection.startLineNumber, potentialStart + 1))
        return
      }
    }
  }

  // Add formatting
  const newText = `${prefix}${text}${suffix}`
  editor.executeEdits('', [
    {
      range: selection,
      text: newText
    }
  ])

  // Update selection to be inside the wrapped text
  if (selection.isEmpty()) {
    // For empty selection, place cursor between markers
    editor.setPosition(
      new monaco.Position(selection.startLineNumber, selection.startColumn + prefix.length)
    )
  } else {
    const newSelection = new monaco.Selection(
      selection.startLineNumber,
      selection.startColumn + prefix.length,
      selection.endLineNumber,
      selection.endColumn + prefix.length
    )
    editor.setSelection(newSelection)
  }
}

// Exclusive groups: switching between members replaces rather than nesting
const HEADING_PREFIXES = ['# ', '## ', '### ', '#### ', '##### ', '###### ']
const LIST_PREFIXES = ['- ', '1. ', '- [ ] ']

/**
 * Inserts text at the beginning of the current line.
 * When exclusiveGroup is provided, switching between group members replaces
 * the existing prefix rather than nesting (e.g., H1 on an H2 line → replaces).
 */
function insertAtLineStart(
  editor: monaco.editor.IStandaloneCodeEditor,
  text: string,
  exclusiveGroup?: string[]
): void {
  const selection = editor.getSelection()
  const model = editor.getModel()
  if (!selection || !model) return

  const lineNumber = selection.startLineNumber
  const lineContent = model.getLineContent(lineNumber)

  if (exclusiveGroup) {
    // Sort longest-first to avoid partial matches (e.g., '- [ ] ' before '- ')
    const sorted = [...exclusiveGroup].sort((a, b) => b.length - a.length)
    const currentPrefix = sorted.find(p => lineContent.startsWith(p))

    if (currentPrefix === text) {
      // Same prefix — toggle off (remove it)
      editor.executeEdits('', [
        { range: new monaco.Range(lineNumber, 1, lineNumber, currentPrefix.length + 1), text: '' }
      ])
    } else if (currentPrefix) {
      // Different prefix in same group — replace it
      editor.executeEdits('', [
        { range: new monaco.Range(lineNumber, 1, lineNumber, currentPrefix.length + 1), text: text }
      ])
    } else {
      // No prefix from this group — add the new prefix
      editor.executeEdits('', [
        { range: new monaco.Range(lineNumber, 1, lineNumber, 1), text: text }
      ])
    }
    return
  }

  // Simple toggle for commands without exclusive groups
  if (lineContent.startsWith(text)) {
    editor.executeEdits('', [
      { range: new monaco.Range(lineNumber, 1, lineNumber, text.length + 1), text: '' }
    ])
  } else {
    editor.executeEdits('', [
      { range: new monaco.Range(lineNumber, 1, lineNumber, 1), text: text }
    ])
  }
}

/**
 * Inserts text at the cursor position
 */
function insertAtCursor(
  editor: monaco.editor.IStandaloneCodeEditor,
  text: string
): void {
  const selection = editor.getSelection()
  if (!selection) return

  editor.executeEdits('', [
    {
      range: selection,
      text: text
    }
  ])

  // Move cursor to the end of inserted text
  const newPosition = new monaco.Position(
    selection.endLineNumber,
    selection.endColumn + text.length
  )
  editor.setPosition(newPosition)
}

// Command implementations

export const markdownCommands = {
  bold: (editor) => wrapSelection(editor, '**'),

  italic: (editor) => wrapSelection(editor, '*'),

  strikethrough: (editor) => wrapSelection(editor, '~~'),

  inlineCode: (editor) => wrapSelection(editor, '`'),

  heading1: (editor) => insertAtLineStart(editor, '# ', HEADING_PREFIXES),

  heading2: (editor) => insertAtLineStart(editor, '## ', HEADING_PREFIXES),

  heading3: (editor) => insertAtLineStart(editor, '### ', HEADING_PREFIXES),

  heading4: (editor) => insertAtLineStart(editor, '#### ', HEADING_PREFIXES),

  heading5: (editor) => insertAtLineStart(editor, '##### ', HEADING_PREFIXES),

  heading6: (editor) => insertAtLineStart(editor, '###### ', HEADING_PREFIXES),

  bulletList: (editor) => insertAtLineStart(editor, '- ', LIST_PREFIXES),

  numberedList: (editor) => insertAtLineStart(editor, '1. ', LIST_PREFIXES),

  taskList: (editor) => insertAtLineStart(editor, '- [ ] ', LIST_PREFIXES),

  blockquote: (editor) => insertAtLineStart(editor, '> '),

  horizontalRule: (editor) => {
    const selection = editor.getSelection()
    if (!selection) return

    insertAtCursor(editor, '\n---\n')
  },

  link: (editor) => {
    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!selection || !model) return

    const text = model.getValueInRange(selection) || 'link text'
    const linkMarkdown = `[${text}](url)`

    editor.executeEdits('', [
      {
        range: selection,
        text: linkMarkdown
      }
    ])

    // Select 'url' so user can type immediately
    const urlStart = selection.startColumn + text.length + 3
    const urlEnd = urlStart + 3
    editor.setSelection(
      new monaco.Selection(
        selection.startLineNumber,
        urlStart,
        selection.startLineNumber,
        urlEnd
      )
    )
  },

  image: (editor) => {
    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!selection || !model) return

    const text = model.getValueInRange(selection) || 'alt text'
    const imageMarkdown = `![${text}](image-url)`

    editor.executeEdits('', [
      {
        range: selection,
        text: imageMarkdown
      }
    ])

    // Select 'image-url' so user can type immediately
    const urlStart = selection.startColumn + text.length + 4
    const urlEnd = urlStart + 9
    editor.setSelection(
      new monaco.Selection(
        selection.startLineNumber,
        urlStart,
        selection.startLineNumber,
        urlEnd
      )
    )
  },

  codeBlock: (editor) => {
    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!selection || !model) return

    const text = model.getValueInRange(selection) || 'code'
    const codeBlockMarkdown = '```javascript\n' + text + '\n```'

    editor.executeEdits('', [
      {
        range: selection,
        text: codeBlockMarkdown
      }
    ])
  },

  table: (editor) => {
    const tableTemplate = `| Column 1 | Column 2 | Column 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`

    insertAtCursor(editor, '\n' + tableTemplate + '\n')
  }
}

export type MarkdownCommand = keyof typeof markdownCommands
