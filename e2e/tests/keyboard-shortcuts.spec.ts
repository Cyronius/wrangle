import { test, expect, waitForMonacoReady } from '../fixtures'

test.describe('Keyboard Shortcuts with Monaco Focus', () => {
  test('Ctrl+1/2/3 should switch view modes when Monaco has focus', async ({ window }) => {
    await waitForMonacoReady(window)

    // Click editor to ensure Monaco has focus
    await window.click('.monaco-editor .view-lines')
    await window.waitForTimeout(500)

    // Determine initial view mode by checking DOM
    const initialPreview = await window.$('.markdown-preview')

    // If we start in editor-only, click the split view toolbar button to set baseline
    if (!initialPreview) {
      const splitButton = await window.$('.view-mode-button:nth-child(2)')
      if (splitButton) {
        await splitButton.click()
      } else {
        await window.click('[title*="Split View"]')
      }
      await window.waitForTimeout(1000)

      // Verify we're now in split mode
      const previewNow = await window.$('.markdown-preview')
      expect(previewNow).toBeTruthy()
    }

    // Re-focus Monaco editor
    await window.click('.monaco-editor .view-lines')
    await window.waitForTimeout(500)

    // --- TEST Ctrl+1: Split → Editor-only ---
    await window.keyboard.press('Control+1')
    await window.waitForTimeout(1000)

    const previewAfterCtrl1 = await window.$('.markdown-preview')
    expect(previewAfterCtrl1).toBeFalsy()
    const editorAfterCtrl1 = await window.$('.monaco-editor')
    expect(editorAfterCtrl1).toBeTruthy()

    // --- TEST Ctrl+2: Editor-only → Split ---
    await window.click('.monaco-editor .view-lines')
    await window.waitForTimeout(300)

    await window.keyboard.press('Control+2')
    await window.waitForTimeout(1000)

    const previewAfterCtrl2 = await window.$('.markdown-preview')
    expect(previewAfterCtrl2).toBeTruthy()
    const editorAfterCtrl2 = await window.$('.monaco-editor')
    expect(editorAfterCtrl2).toBeTruthy()

    // --- TEST Ctrl+3: Split → Preview-only ---
    await window.click('.monaco-editor .view-lines')
    await window.waitForTimeout(300)

    await window.keyboard.press('Control+3')
    await window.waitForTimeout(1000)

    const previewAfterCtrl3 = await window.$('.markdown-preview')
    expect(previewAfterCtrl3).toBeTruthy()

    // In preview-only mode, the Monaco editor is rendered in a 1x1 hidden wrapper
    const editorVisibleAfterCtrl3 = await window.evaluate(() => {
      const editor = document.querySelector('.monaco-editor')
      if (!editor) return false
      const rect = editor.getBoundingClientRect()
      return rect.width > 10 && rect.height > 10
    })
    expect(editorVisibleAfterCtrl3).toBe(false)
  })

  test('Alt key should show drag overlay when Monaco focused', async ({ window }) => {
    await waitForMonacoReady(window)

    // Click editor to ensure Monaco has focus
    await window.click('.monaco-editor .view-lines')
    await window.waitForTimeout(300)

    // Verify overlay is NOT visible initially
    let overlay = await window.$('.window-drag-overlay')
    expect(overlay).toBeFalsy()

    // Press Alt down
    await window.keyboard.down('Alt')
    await window.waitForTimeout(300)

    // Verify overlay IS visible
    overlay = await window.$('.window-drag-overlay')
    expect(overlay).toBeTruthy()

    // Release Alt
    await window.keyboard.up('Alt')
    await window.waitForTimeout(300)

    // Verify overlay disappears
    overlay = await window.$('.window-drag-overlay')
    expect(overlay).toBeFalsy()
  })
})
