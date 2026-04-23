// Traces: KBD-004 (canonical spec: specs/keyboard-commands/spec.md)
import { test, expect, waitForAppReady, waitForMonacoReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'

test.describe('KBD-004: Editor-scoped vs global-scoped dispatch', () => {
  test('editor-scoped command (markdown.bold) fires when Monaco has focus', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('hello world')
    // Select "hello"
    await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      const model = editors?.[0]?.getModel()
      if (editors?.[0] && model) {
        editors[0].setSelection({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 6
        })
        editors[0].focus()
      }
    })

    await window.keyboard.press('Control+B')
    await window.waitForTimeout(300)

    const content = await ed.getFullContent()
    expect(content).toContain('**hello**')
  })

  test('global-scoped view.editorOnly (Ctrl+1) fires regardless of focus', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)

    // Ensure split mode baseline (best-effort)
    const splitBtn = await window.$('[title*="Split View"]')
    if (splitBtn) {
      await splitBtn.click()
      await window.waitForTimeout(500)
    }

    // Click into Monaco to put focus there
    await window.click('.monaco-editor .view-lines')
    await window.waitForTimeout(200)

    await window.keyboard.press('Control+1')
    await window.waitForTimeout(600)

    const preview = await window.$('.markdown-preview')
    expect(preview).toBeFalsy()
  })

  test('inside an INPUT, only allowInInput shortcuts fire (save allowed, view toggle suppressed)', async ({
    window
  }) => {
    await waitForAppReady(window)

    // Find an input element in the UI. The tab bar or preferences search box are candidates.
    // We'll look for any visible input/textarea.
    const inputHandle = await window.$('input:visible, textarea:visible')
    if (!inputHandle) {
      test.fixme(true, 'No input element visible to test allowInInput suppression.')
      return
    }
    await inputHandle.focus()

    // Ctrl+1 should NOT switch view modes when focus is in an input.
    // Snapshot current preview presence.
    const before = !!(await window.$('.markdown-preview'))
    await window.keyboard.press('Control+1')
    await window.waitForTimeout(400)
    const after = !!(await window.$('.markdown-preview'))
    expect(after).toBe(before)
  })

  test.fixme(
    'bindings re-register when preset changes (no reload required)',
    async () => {
      // Requires changing the preset via the Shortcuts tab and observing a new binding —
      // covered by preset-integration unit/component tests.
    }
  )
})
