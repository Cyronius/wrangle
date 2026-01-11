import * as monaco from 'monaco-editor'

type EditorCommand = (editor: monaco.editor.IStandaloneCodeEditor) => void

/**
 * Wraps the current selection with prefix and suffix
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
  const newText = `${prefix}${text}${suffix}`

  editor.executeEdits('', [
    {
      range: selection,
      text: newText
    }
  ])

  // Update selection to be inside the wrapped text
  const newSelection = new monaco.Selection(
    selection.startLineNumber,
    selection.startColumn + prefix.length,
    selection.endLineNumber,
    selection.endColumn + prefix.length
  )
  editor.setSelection(newSelection)
}

/**
 * Inserts text at the beginning of the current line
 */
function insertAtLineStart(
  editor: monaco.editor.IStandaloneCodeEditor,
  text: string
): void {
  const selection = editor.getSelection()
  const model = editor.getModel()
  if (!selection || !model) return

  const lineNumber = selection.startLineNumber
  const lineContent = model.getLineContent(lineNumber)

  // Check if line already starts with the text (toggle behavior)
  if (lineContent.startsWith(text)) {
    // Remove the prefix
    editor.executeEdits('', [
      {
        range: new monaco.Range(lineNumber, 1, lineNumber, text.length + 1),
        text: ''
      }
    ])
  } else {
    // Add the prefix
    editor.executeEdits('', [
      {
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        text: text
      }
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

  heading1: (editor) => insertAtLineStart(editor, '# '),

  heading2: (editor) => insertAtLineStart(editor, '## '),

  heading3: (editor) => insertAtLineStart(editor, '### '),

  heading4: (editor) => insertAtLineStart(editor, '#### '),

  heading5: (editor) => insertAtLineStart(editor, '##### '),

  heading6: (editor) => insertAtLineStart(editor, '###### '),

  bulletList: (editor) => insertAtLineStart(editor, '- '),

  numberedList: (editor) => insertAtLineStart(editor, '1. '),

  taskList: (editor) => insertAtLineStart(editor, '- [ ] '),

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
