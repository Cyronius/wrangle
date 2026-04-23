// Traces: KBD-006 (canonical spec: specs/keyboard-commands/spec.md)
import { test, expect, waitForAppReady, waitForMonacoReady, waitForPreviewReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'

test.describe('KBD-006: WYSIWYG applyPreviewSelection path', () => {
  test('selecting text in the preview and pressing Ctrl+B bolds the underlying source', async ({
    window
  }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('hello world')
    // Ensure split-view so preview is visible.
    const previewEl = await window.$('.markdown-preview')
    if (!previewEl) {
      test.fixme(true, 'Preview pane not visible; cannot exercise WYSIWYG path.')
      return
    }
    await waitForPreviewReady(window)

    // Select "hello" within the preview DOM.
    const selected = await window.evaluate(() => {
      const body = document.querySelector('.markdown-body')
      if (!body) return false
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
      const node = walker.nextNode() as Text | null
      if (!node || !node.textContent) return false
      const idx = node.textContent.indexOf('hello')
      if (idx < 0) return false
      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + 5)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      return true
    })
    if (!selected) {
      test.fixme(true, 'Could not create a preview text selection.')
      return
    }

    // Fire the bold shortcut against the window (global dispatch path).
    await window.keyboard.press('Control+B')
    await window.waitForTimeout(300)

    const content = await ed.getFullContent()
    expect(content).toContain('**hello**')
  })

  test('null previewSelection is a no-op: editor selection is used unchanged', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('foo bar')
    // Set editor selection to "foo".
    await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors?.[0]) {
        editors[0].setSelection({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 4
        })
        editors[0].focus()
      }
    })

    // Clear any DOM selection in the preview.
    await window.evaluate(() => window.getSelection()?.removeAllRanges())

    await window.keyboard.press('Control+B')
    await window.waitForTimeout(200)

    expect(await ed.getFullContent()).toBe('**foo** bar')
  })
})
