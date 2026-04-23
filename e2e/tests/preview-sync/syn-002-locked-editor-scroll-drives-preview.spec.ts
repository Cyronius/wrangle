// Traces: SYN-002 (canonical spec: specs/preview-sync/spec.md)
import { test, expect, waitForAppReady } from '../../fixtures'
import { EditorHelpers } from '../../helpers/editor-helpers'
import { PreviewHelpers } from '../../helpers/preview-helpers'

function longMarkdown(): string {
  let md = '# Top Heading\n\n'
  for (let i = 1; i <= 40; i++) {
    md += `Paragraph number ${i} with enough text to fill a line in the preview.\n\n`
  }
  md += '## Bottom Heading\n\nFinal paragraph.\n'
  return md
}

test.describe('SYN-002: Locked Editor Scroll Drives Preview', () => {
  test.beforeEach(async ({ window }) => {
    await waitForAppReady(window)
    const editor = new EditorHelpers(window)
    await editor.setContent(longMarkdown())
    await window.waitForTimeout(800)
  })

  test('scrolling the editor scrolls the preview while locked', async ({ window }) => {
    const preview = new PreviewHelpers(window)

    // Ensure lock is engaged (default) and grab initial preview scrollTop.
    const cls = await window.getAttribute('.sync-lock-icon', 'class')
    expect(cls).toContain('synced')

    const initialPreviewScroll = await preview.getScrollPosition()

    // Scroll the editor to the end of the document to drive the preview.
    await window.click('.monaco-editor .view-lines')
    await window.keyboard.press('Control+End')
    await window.waitForTimeout(500)

    const afterPreviewScroll = await preview.getScrollPosition()
    expect(afterPreviewScroll).toBeGreaterThan(initialPreviewScroll)
  })

  test('editor scroll maps to the element whose source range contains the offset', async ({
    window
  }) => {
    const preview = new PreviewHelpers(window)

    // Jump the editor cursor near the bottom heading to drive preview mapping.
    await window.click('.monaco-editor .view-lines')
    await window.keyboard.press('Control+End')
    await window.waitForTimeout(500)

    // The highlight (source-highlight) marks the element mapped from the cursor.
    const highlightedId = await preview.getHighlightedElement()
    expect(highlightedId).not.toBeNull()

    // The matched element must actually exist in the DOM with data-source-start.
    const matched = await preview.getElementBySourceId(highlightedId as string)
    expect(matched).not.toBeNull()
    expect(matched?.bounds.height).toBeGreaterThan(0)
  })

  test('no-op when previewSync is false', async ({ window }) => {
    const preview = new PreviewHelpers(window)

    // Unlock.
    await window.click('.sync-lock-icon')
    await window.waitForTimeout(150)
    const cls = await window.getAttribute('.sync-lock-icon', 'class')
    expect(cls).toContain('unsynced')

    const before = await preview.getScrollPosition()

    // Drive the editor scroll. With sync disabled the preview should not move.
    await window.click('.monaco-editor .view-lines')
    await window.keyboard.press('Control+End')
    await window.waitForTimeout(500)

    const after = await preview.getScrollPosition()
    expect(after).toBe(before)
  })

  test('re-entrancy guard prevents preview->editor bounce during editor-driven scroll', async ({
    window
  }) => {
    const preview = new PreviewHelpers(window)
    const editor = new EditorHelpers(window)

    // Move the editor cursor and immediately sample the preview scroll, then
    // sample again after a short delay. The preview should settle to a stable
    // position (not oscillate) because the guard blocks the echo.
    await window.click('.monaco-editor .view-lines')
    await window.keyboard.press('Control+End')
    await window.waitForTimeout(150)
    const mid = await preview.getScrollPosition()

    // After the 100ms guard releases, the preview should not have snapped
    // back to 0 (which would indicate the editor-reveal echoed).
    await window.waitForTimeout(400)
    const settled = await preview.getScrollPosition()

    expect(settled).toBeGreaterThan(0)
    // Allow some natural settling difference but never a reset to zero.
    expect(Math.abs(settled - mid)).toBeLessThan(Math.max(mid, 1))

    // Editor cursor should still be near the end (not yanked back).
    const pos = await editor.getCursorLineColumn()
    expect(pos.line).toBeGreaterThan(10)
  })
})
