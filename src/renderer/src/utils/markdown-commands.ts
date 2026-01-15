import * as monaco from 'monaco-editor'

type EditorCommand = (editor: monaco.editor.IStandaloneCodeEditor) => void

/**
 * Find marker pairs in a line for a given prefix/suffix
 * Returns array of {openStart, openEnd, closeStart, closeEnd} positions (0-indexed)
 */
function findMarkerPairs(
  lineContent: string,
  prefix: string,
  suffix: string
): Array<{ openStart: number; openEnd: number; closeStart: number; closeEnd: number }> {
  const pairs: Array<{ openStart: number; openEnd: number; closeStart: number; closeEnd: number }> = []

  // Escape special regex characters in prefix
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // For bold (**), we need to avoid matching italic (*) markers
  // Use negative lookbehind/lookahead where possible
  let pattern: RegExp
  if (prefix === '**') {
    // Match ** not preceded or followed by another *
    pattern = /(?<!\*)\*\*(?!\*)/g
  } else if (prefix === '*') {
    // Match single * not preceded or followed by *
    pattern = /(?<!\*)\*(?!\*)/g
  } else {
    pattern = new RegExp(escapedPrefix, 'g')
  }

  const matches: number[] = []
  let match
  while ((match = pattern.exec(lineContent)) !== null) {
    matches.push(match.index)
  }

  // Pair up markers (assume even number, pair 0-1, 2-3, etc.)
  for (let i = 0; i < matches.length - 1; i += 2) {
    pairs.push({
      openStart: matches[i],
      openEnd: matches[i] + prefix.length,
      closeStart: matches[i + 1],
      closeEnd: matches[i + 1] + suffix.length
    })
  }

  return pairs
}

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

    // Check if selection is inside a formatted region (context-aware)
    // e.g., selecting "text" inside "**text**" should remove the formatting
    const pairs = findMarkerPairs(lineContent, prefix, suffix)
    const selStart = selection.startColumn - 1 // 0-indexed
    const selEnd = selection.endColumn - 1 // 0-indexed

    for (const pair of pairs) {
      // Check if selection is fully contained within this formatted region
      // The content is between openEnd and closeStart
      if (selStart >= pair.openEnd && selEnd <= pair.closeStart) {
        // Selection is inside this formatted region - unwrap the entire region
        const regionText = lineContent.substring(pair.openEnd, pair.closeStart)
        const expandedRange = new monaco.Range(
          selection.startLineNumber,
          pair.openStart + 1, // 1-indexed
          selection.startLineNumber,
          pair.closeEnd + 1 // 1-indexed
        )
        editor.executeEdits('', [
          {
            range: expandedRange,
            text: regionText
          }
        ])
        // Adjust selection to account for removed prefix
        editor.setSelection(
          new monaco.Selection(
            selection.startLineNumber,
            selStart + 1 - prefix.length, // Shift left by prefix length
            selection.startLineNumber,
            selEnd + 1 - prefix.length
          )
        )
        return
      }
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

    // Check if cursor is inside a formatted region (for toggle off)
    const pairs = findMarkerPairs(lineContent, prefix, suffix)
    for (const pair of pairs) {
      if (col >= pair.openEnd && col <= pair.closeStart) {
        // Cursor is inside this formatted region - unwrap it
        const regionText = lineContent.substring(pair.openEnd, pair.closeStart)
        const expandedRange = new monaco.Range(
          selection.startLineNumber,
          pair.openStart + 1,
          selection.startLineNumber,
          pair.closeEnd + 1
        )
        editor.executeEdits('', [
          {
            range: expandedRange,
            text: regionText
          }
        ])
        // Position cursor, accounting for removed prefix
        editor.setPosition(new monaco.Position(selection.startLineNumber, col + 1 - prefix.length))
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
