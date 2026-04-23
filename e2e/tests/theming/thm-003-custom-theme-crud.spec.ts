// Traces: THM-003 (canonical spec: specs/theming/spec.md)
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

async function copyCurrentTheme(window: import('@playwright/test').Page): Promise<string> {
  const copyBtn = await window.waitForSelector('.theme-name-edit-btn.copy', { timeout: 3000 })
  await copyBtn.click()
  await window.waitForTimeout(800)
  return window.$eval('.theme-select select', (el) => (el as HTMLSelectElement).value)
}

test.describe('THM-003: Custom theme CRUD via Theme Editor tab', () => {
  test('Copy from Dark creates <base>-copy custom theme and makes it active', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')

    const newName = await copyCurrentTheme(window)
    expect(newName).toMatch(/^Dark-copy( \d+)?$/)

    const dataTheme = await window.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(dataTheme).toBe(newName)

    const customKeys = await window.evaluate(() => {
      const el = document.querySelector('.theme-select select') as HTMLSelectElement | null
      if (!el) return [] as string[]
      const userGroup = Array.from(el.querySelectorAll('optgroup')).find(
        (og) => og.getAttribute('label') === 'User Themes'
      )
      if (!userGroup) return [] as string[]
      return Array.from(userGroup.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value)
    })
    expect(customKeys).toContain(newName)

    await window.keyboard.press('Escape')
  })

  test('Edit: typing in CSS editor of a custom theme persists via debounced save', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')
    const newName = await copyCurrentTheme(window)

    // Replace a value via Monaco model then type to trigger onChange.
    await window.evaluate(() => {
      const editors = (window as unknown as { monaco?: { editor: { getEditors: () => Array<{ getModel: () => { getValue: () => string; setValue: (v: string) => void } | null }> } } }).monaco?.editor?.getEditors?.()
      if (!editors) return
      const container = document.querySelector('.theme-editor-container')
      for (const ed of editors) {
        const dom = (ed as unknown as { getDomNode?: () => HTMLElement }).getDomNode?.()
        if (dom && container && container.contains(dom)) {
          const model = ed.getModel()
          if (model) {
            const v = model.getValue()
            model.setValue(v.replace(/--app-bg:\s*[^;]+;/, '--app-bg: #123456;'))
          }
          return
        }
      }
    })
    const editorArea = await window.waitForSelector('.theme-editor-container .monaco-editor .view-lines', { timeout: 5000 })
    await editorArea.click()
    await window.keyboard.press('End')
    await window.keyboard.type(' ')
    // Wait debounce (1500ms) + buffer
    await window.waitForTimeout(2500)

    // Verify CSS in redux-backed store is reflected in the active style element.
    const css = await window.evaluate(() => {
      const style = document.getElementById('custom-theme-active')
      return style?.textContent || ''
    })
    expect(css).toContain('#123456')

    // And the computed var should update, since this is the active theme.
    const appBg = await window.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    )
    expect(appBg).toBe('#123456')

    expect(newName).toBeTruthy()
    await window.keyboard.press('Escape')
  })

  test('Rename: pencil + save updates select value, data-theme, and CSS selector', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')
    const original = await copyCurrentTheme(window)

    const renamed = `renamed-${Date.now()}`

    const pencil = await window.waitForSelector('.theme-name-edit-btn.pencil', { timeout: 3000 })
    await pencil.click()

    const input = await window.waitForSelector('.theme-name-edit-input', { timeout: 3000 })
    await input.click({ clickCount: 3 })
    await window.keyboard.type(renamed)

    const saveBtn = await window.waitForSelector('.theme-name-edit-btn.save', { timeout: 3000 })
    await saveBtn.click()
    await window.waitForTimeout(800)

    const selectValue = await window.$eval('.theme-select select', (el) => (el as HTMLSelectElement).value)
    expect(selectValue).toBe(renamed)

    const dataTheme = await window.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(dataTheme).toBe(renamed)

    const css = await window.evaluate(() => {
      const style = document.getElementById('custom-theme-active')
      return style?.textContent || ''
    })
    expect(css).toContain(`:root[data-theme='${renamed}']`)
    expect(css).not.toContain(`:root[data-theme='${original}']`)

    await window.keyboard.press('Escape')
  })

  test('Rename rejects conflicts with existing theme names', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')
    const newName = await copyCurrentTheme(window)

    const pencil = await window.waitForSelector('.theme-name-edit-btn.pencil', { timeout: 3000 })
    await pencil.click()

    const input = await window.waitForSelector('.theme-name-edit-input', { timeout: 3000 })
    await input.click({ clickCount: 3 })
    await window.keyboard.type('Dark') // Conflicts with built-in

    // The save button should be disabled while the name conflicts.
    const saveDisabled = await window.evaluate(() => {
      const btn = document.querySelector('.theme-name-edit-btn.save') as HTMLButtonElement | null
      return btn ? btn.disabled : null
    })
    expect(saveDisabled).toBe(true)

    // Cancel out so we don't leave the UI in an editing state.
    const cancel = await window.waitForSelector('.theme-name-edit-btn.cancel', { timeout: 3000 })
    await cancel.click()

    // Still on newName.
    const selectValue = await window.$eval('.theme-select select', (el) => (el as HTMLSelectElement).value)
    expect(selectValue).toBe(newName)

    await window.keyboard.press('Escape')
  })

  test('Delete: removing active custom theme resets current to Dark', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')
    const newName = await copyCurrentTheme(window)
    expect(newName).toBeTruthy()

    // Auto-confirm the window.confirm prompt.
    await window.evaluate(() => {
      ;(window as unknown as { confirm: (m?: string) => boolean }).confirm = () => true
    })

    const deleteBtn = await window.waitForSelector('.theme-actions button:has-text("Delete")', { timeout: 3000 })
    await deleteBtn.click()
    await window.waitForTimeout(600)

    const state = await window.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute('data-theme'),
      selectValue: (document.querySelector('.theme-select select') as HTMLSelectElement | null)?.value ?? null
    }))
    expect(state.selectValue).toBe('Dark')
    expect(state.dataTheme).toBe('Dark')

    await window.keyboard.press('Escape')
  })

  test('Built-in theme selected: pencil (rename) control is hidden', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')

    const pencil = await window.$('.theme-name-edit-btn.pencil')
    expect(pencil).toBeNull()

    await window.keyboard.press('Escape')
  })
})
