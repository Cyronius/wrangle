// Traces: SYN-005 (canonical spec: specs/preview-sync/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'
import { PreviewHelpers } from '../../helpers/preview-helpers'

function tallMarkdown(): string {
  let md = '# Unlock Top\n\n'
  for (let i = 1; i <= 50; i++) {
    md += `Row ${i} paragraph with meaningful text for scroll.\n\n`
  }
  md += '## Unlock Bottom\n\nFinal row.\n'
  return md
}

test.describe('SYN-005: Unlocked State Decouples Scrolling', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    const editor = new EditorHelpers(window)
    await editor.setContent(tallMarkdown())
    await window.waitForTimeout(700)

    // Unlock for every test in this describe block.
    const cls = await window.getAttribute('.sync-lock-icon', 'class')
    if (cls?.includes('synced') && !cls.includes('unsynced')) {
      await window.click('.sync-lock-icon')
      await window.waitForTimeout(150)
    }
    const after = await window.getAttribute('.sync-lock-icon', 'class')
    expect(after).toContain('unsynced')
  })

  test('editor scroll does not move preview when unlocked', async ({ window }) => {
    const preview = new PreviewHelpers(window)

    const before = await preview.getScrollPosition()

    await window.click('.monaco-editor .view-lines')
    await window.keyboard.press('Control+End')
    await window.waitForTimeout(500)

    const after = await preview.getScrollPosition()
    expect(after).toBe(before)
  })

  test('preview scroll does not move editor cursor when unlocked', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    const before = await editor.getCursorLineColumn()

    await preview.scrollTo(500)
    await window.waitForTimeout(400)

    const after = await editor.getCursorLineColumn()
    expect(after.line).toBe(before.line)
    expect(after.column).toBe(before.column)
  })

  test('sync lock icon remains interactive and re-enables sync', async ({ window }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Re-lock via the icon.
    await window.click('.sync-lock-icon')
    await window.waitForTimeout(150)
    const cls = await window.getAttribute('.sync-lock-icon', 'class')
    expect(cls).toContain('synced')

    // Now editor scroll should again drive preview.
    const beforeScroll = await preview.getScrollPosition()
    await window.click('.monaco-editor .view-lines')
    await window.keyboard.press('Control+End')
    await window.waitForTimeout(500)
    const afterScroll = await preview.getScrollPosition()
    expect(afterScroll).toBeGreaterThan(beforeScroll)

    // And editor cursor has moved to the bottom.
    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBeGreaterThan(10)
  })

  test('two independent scroll positions coexist while unlocked', async ({ window }) => {
    const preview = new PreviewHelpers(window)

    // Drive preview alone.
    await preview.scrollTo(300)
    await window.waitForTimeout(200)
    const previewAfter = await preview.getScrollPosition()
    expect(previewAfter).toBeGreaterThan(0)

    // Editor remains at its default top-of-document position.
    const editorScrollTop = await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      return editors?.[0]?.getScrollTop?.() ?? 0
    })
    expect(editorScrollTop).toBe(0)

    // Now drive the editor alone; the preview should remain where it was.
    await window.click('.monaco-editor .view-lines')
    await window.keyboard.press('Control+End')
    await window.waitForTimeout(400)

    const previewStill = await preview.getScrollPosition()
    expect(previewStill).toBe(previewAfter)

    const editorScrollAfter = await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      return editors?.[0]?.getScrollTop?.() ?? 0
    })
    expect(editorScrollAfter).toBeGreaterThan(0)
  })
})
