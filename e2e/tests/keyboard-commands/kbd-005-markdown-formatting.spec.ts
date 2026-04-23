// Traces: KBD-005 (canonical spec: specs/keyboard-commands/spec.md)
import { test, expect, waitForAppReady, waitForMonacoReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'

async function selectLine1Chars(window: import('@playwright/test').Page, startCol: number, endCol: number): Promise<void> {
  await window.evaluate(
    ({ startCol, endCol }) => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors?.[0]) {
        editors[0].setSelection({
          startLineNumber: 1,
          startColumn: startCol,
          endLineNumber: 1,
          endColumn: endCol
        })
        editors[0].focus()
      }
    },
    { startCol, endCol }
  )
}

test.describe('KBD-005: Markdown formatting commands', () => {
  test('Ctrl+B wraps selection with ** ** (bold)', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('hello world')
    await selectLine1Chars(window, 1, 6) // "hello"
    await window.keyboard.press('Control+B')
    await window.waitForTimeout(200)

    expect(await ed.getFullContent()).toBe('**hello** world')
  })

  test('Ctrl+I wraps selection with * * (italic)', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('hello world')
    await selectLine1Chars(window, 1, 6)
    await window.keyboard.press('Control+I')
    await window.waitForTimeout(200)

    expect(await ed.getFullContent()).toBe('*hello* world')
  })

  test('Ctrl+Shift+X wraps selection with ~~ ~~ (strikethrough)', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('hello world')
    await selectLine1Chars(window, 1, 6)
    await window.keyboard.press('Control+Shift+X')
    await window.waitForTimeout(200)

    expect(await ed.getFullContent()).toBe('~~hello~~ world')
  })

  test('Ctrl+` wraps selection with backticks (inline code)', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('hello world')
    await selectLine1Chars(window, 1, 6)
    await window.keyboard.press('Control+`')
    await window.waitForTimeout(200)

    expect(await ed.getFullContent()).toBe('`hello` world')
  })

  test('Ctrl+Alt+1 prepends "# " to the current line (heading 1)', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('my heading')
    await selectLine1Chars(window, 1, 1)
    await window.keyboard.press('Control+Alt+1')
    await window.waitForTimeout(200)

    expect(await ed.getFullContent()).toBe('# my heading')
  })

  test('Ctrl+Shift+8 prepends "- " (bullet list) to each selected line', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('one\ntwo\nthree')
    await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors?.[0]) {
        editors[0].setSelection({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 3,
          endColumn: 6
        })
        editors[0].focus()
      }
    })
    await window.keyboard.press('Control+Shift+8')
    await window.waitForTimeout(200)

    expect(await ed.getFullContent()).toBe('- one\n- two\n- three')
  })

  test('Ctrl+Shift+7 prepends "1. " (numbered list)', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('item')
    await selectLine1Chars(window, 1, 1)
    await window.keyboard.press('Control+Shift+7')
    await window.waitForTimeout(200)

    expect(await ed.getFullContent()).toBe('1. item')
  })

  test('Ctrl+Shift+9 prepends "- [ ] " (task list)', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('do it')
    await selectLine1Chars(window, 1, 1)
    await window.keyboard.press('Control+Shift+9')
    await window.waitForTimeout(200)

    expect(await ed.getFullContent()).toBe('- [ ] do it')
  })

  test('Ctrl+Shift+. prepends "> " (blockquote)', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('quote me')
    await selectLine1Chars(window, 1, 1)
    await window.keyboard.press('Control+Shift+.')
    await window.waitForTimeout(200)

    expect(await ed.getFullContent()).toBe('> quote me')
  })

  test('Ctrl+K inserts link template (no selection places cursor on placeholder)', async ({
    window
  }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('')
    await window.click('.monaco-editor .view-lines')
    await window.keyboard.press('Control+K')
    await window.waitForTimeout(200)

    const content = await ed.getFullContent()
    expect(content).toContain('[')
    expect(content).toContain('](url)')
  })

  test('Ctrl+Shift+` wraps selection in a triple-backtick fenced code block', async ({ window }) => {
    await waitForAppReady(window)
    await waitForMonacoReady(window)
    const ed = new EditorHelpers(window)

    await ed.setContent('console.log(1)')
    await selectLine1Chars(window, 1, 15)
    await window.keyboard.press('Control+Shift+`')
    await window.waitForTimeout(200)

    const content = await ed.getFullContent()
    expect(content).toMatch(/```\n?console\.log\(1\)\n?```/)
  })
})
