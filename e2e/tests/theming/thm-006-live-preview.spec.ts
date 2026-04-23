// Traces: THM-006 (canonical spec: specs/theming/spec.md)
import { test, expect } from '../../fixtures'

async function openThemeEditor(window: import('@playwright/test').Page): Promise<void> {
  await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
  await window.keyboard.press('Control+,')
  await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })
  const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
  await themesTab.click()
  await window.waitForSelector('.theme-select select', { state: 'visible', timeout: 5000 })
}

async function selectBuiltin(window: import('@playwright/test').Page, name: string): Promise<void> {
  const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
  await themeSelect.selectOption(name)
  await window.waitForTimeout(400)
}

async function copyCurrent(window: import('@playwright/test').Page): Promise<string> {
  const btn = await window.waitForSelector('.theme-name-edit-btn.copy', { timeout: 3000 })
  await btn.click()
  await window.waitForTimeout(800)
  return window.$eval('.theme-select select', (el) => (el as HTMLSelectElement).value)
}

async function setEditorCSS(window: import('@playwright/test').Page, replaceRegexSrc: string, replacement: string): Promise<void> {
  await window.evaluate(({ re, rep }) => {
    const editors = (window as unknown as { monaco?: { editor: { getEditors: () => Array<{ getModel: () => { getValue: () => string; setValue: (v: string) => void } | null; getDomNode?: () => HTMLElement }> } } }).monaco?.editor?.getEditors?.()
    if (!editors) return
    const container = document.querySelector('.theme-editor-container')
    for (const ed of editors) {
      const dom = ed.getDomNode?.()
      if (dom && container && container.contains(dom)) {
        const m = ed.getModel()
        if (m) m.setValue(m.getValue().replace(new RegExp(re), rep))
        return
      }
    }
  }, { re: replaceRegexSrc, rep: replacement })
  const editorArea = await window.waitForSelector('.theme-editor-container .monaco-editor .view-lines', { timeout: 5000 })
  await editorArea.click()
  await window.keyboard.press('End')
  await window.keyboard.type(' ')
}

test.describe('THM-006: Live preview while editing in Theme Editor', () => {
  test('editing CSS of active custom theme updates computed --app-bg after debounce', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')
    await copyCurrent(window)

    await setEditorCSS(window, '--app-bg:\\s*[^;]+;', '--app-bg: #abcdef;')

    // Before debounce fires, computed value should NOT yet be updated reliably.
    // After debounce (1500ms) + buffer, it must reflect the edit.
    await window.waitForTimeout(2500)

    const appBg = await window.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    )
    expect(appBg).toBe('#abcdef')

    const injected = await window.evaluate(() => document.getElementById('custom-theme-active')?.textContent || '')
    expect(injected).toContain('#abcdef')

    await window.keyboard.press('Escape')
  })

  test('validation errors display inline and block debounced save (no CSS change applied)', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')
    await copyCurrent(window)

    // Capture the current injected CSS.
    const before = await window.evaluate(() => document.getElementById('custom-theme-active')?.textContent || '')

    // Introduce clearly invalid CSS by wiping the model to gibberish.
    await window.evaluate(() => {
      const editors = (window as unknown as { monaco?: { editor: { getEditors: () => Array<{ getModel: () => { setValue: (v: string) => void } | null; getDomNode?: () => HTMLElement }> } } }).monaco?.editor?.getEditors?.()
      if (!editors) return
      const container = document.querySelector('.theme-editor-container')
      for (const ed of editors) {
        const dom = ed.getDomNode?.()
        if (dom && container && container.contains(dom)) {
          const m = ed.getModel()
          if (m) m.setValue('this is not valid css at all {{{{')
          return
        }
      }
    })
    const editorArea = await window.waitForSelector('.theme-editor-container .monaco-editor .view-lines', { timeout: 5000 })
    await editorArea.click()
    await window.keyboard.press('End')
    await window.keyboard.type(' ')
    await window.waitForTimeout(2500)

    // Either the validation error UI renders OR the injected CSS is unchanged (save blocked).
    const errorVisible = await window.evaluate(() => !!document.querySelector('.theme-validation-error'))
    const after = await window.evaluate(() => document.getElementById('custom-theme-active')?.textContent || '')

    // Save should NOT have dispatched: the injected custom-theme-active element's content should
    // still match what was there before (the prior valid CSS).
    expect(after).toBe(before)
    // The validation error UI being visible is the positive signal; assert it too.
    expect(errorVisible).toBe(true)

    await window.keyboard.press('Escape')
  })

  test('Apply button performs an immediate, non-debounced apply', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')
    await copyCurrent(window)

    await setEditorCSS(window, '--app-bg:\\s*[^;]+;', '--app-bg: #bada55;')

    // Click Apply immediately (no debounce wait).
    const applyBtn = await window.waitForSelector('.theme-actions button:has-text("Apply")', { timeout: 3000 })
    await applyBtn.click()
    await window.waitForTimeout(300)

    // applyCustomThemeCSS in ThemeEditorTab injects <style id="custom-theme-<name>"> with the new CSS
    // and sets data-theme to that name, so the computed variable should update right away.
    const appBg = await window.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    )
    expect(appBg).toBe('#bada55')

    await window.keyboard.press('Escape')
  })

  test('switching themes mid-edit saves edits to the original theme, not the newly-switched one', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')
    const themeA = await copyCurrent(window)

    // Start an edit on themeA.
    await setEditorCSS(window, '--app-bg:\\s*[^;]+;', '--app-bg: #aa0000;')

    // Before the debounce fires, create another custom theme and switch away to it.
    // Copy again (this will make themeA-copy or Dark-copy 2) — selecting the new theme immediately.
    const themeB = await copyCurrent(window)
    expect(themeB).not.toBe(themeA)

    // Wait past the original debounce window.
    await window.waitForTimeout(2500)

    // Switch back to themeA and inspect its CSS via the editor.
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption(themeA)
    await window.waitForTimeout(800)

    const themeACSS = await window.evaluate(() => {
      const editors = (window as unknown as { monaco?: { editor: { getEditors: () => Array<{ getValue: () => string; getDomNode?: () => HTMLElement }> } } }).monaco?.editor?.getEditors?.()
      if (!editors) return ''
      const container = document.querySelector('.theme-editor-container')
      for (const ed of editors) {
        const dom = ed.getDomNode?.()
        if (dom && container && container.contains(dom)) return ed.getValue()
      }
      return ''
    })

    // The edit captured at call-time should have saved to themeA, not themeB.
    expect(themeACSS).toContain('#aa0000')

    await window.keyboard.press('Escape')
  })
})
