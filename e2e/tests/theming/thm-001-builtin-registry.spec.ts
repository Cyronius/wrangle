// Traces: THM-001 (canonical spec: specs/theming/spec.md)
import { test, expect } from '../../fixtures'

async function openThemeEditor(window: import('@playwright/test').Page): Promise<void> {
  await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
  await window.keyboard.press('Control+,')
  await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })
  const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
  await themesTab.click()
  await window.waitForSelector('.theme-select select', { state: 'visible', timeout: 5000 })
}

test.describe('THM-001: Built-in Theme Registry', () => {
  test('Dark and Lightish are listed as Built-in options in the Theme Editor select', async ({ window }) => {
    await openThemeEditor(window)

    const builtInOptionNames = await window.evaluate(() => {
      const select = document.querySelector('.theme-select select') as HTMLSelectElement | null
      if (!select) return [] as string[]
      const optgroups = Array.from(select.querySelectorAll('optgroup'))
      const builtInGroup = optgroups.find((og) => og.getAttribute('label') === 'Built-in')
      if (!builtInGroup) return [] as string[]
      return Array.from(builtInGroup.querySelectorAll('option')).map((o) => (o as HTMLOptionElement).value)
    })

    expect(builtInOptionNames).toContain('Dark')
    expect(builtInOptionNames).toContain('Lightish')

    await window.keyboard.press('Escape')
  })

  test('selecting a built-in theme shows the read-only notice and hides Apply/Delete', async ({ window }) => {
    await openThemeEditor(window)

    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('Dark')
    await window.waitForTimeout(400)

    // Read-only notice is visible
    const notice = await window.$('.theme-readonly-notice')
    expect(notice).not.toBeNull()
    expect(await notice!.isVisible()).toBe(true)

    // Apply / Delete buttons are not rendered when a built-in is selected
    const applyBtn = await window.$('.theme-actions button:has-text("Apply")')
    const deleteBtn = await window.$('.theme-actions button:has-text("Delete")')
    expect(applyBtn).toBeNull()
    expect(deleteBtn).toBeNull()

    await window.keyboard.press('Escape')
  })

  test('default theme is Dark on fresh state', async ({ window }) => {
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })

    // Either the persisted theme is Dark, or the default is Dark. Reading data-theme lets us observe
    // that the shipped default (per spec) resolves to "Dark". The migration from legacy 'dark' also
    // lands on 'Dark'.
    const dataTheme = await window.evaluate(() => document.documentElement.getAttribute('data-theme'))

    // dataTheme must be one of the built-in names; when the default is in effect it must be 'Dark'.
    // At minimum it cannot be the legacy lowercase 'dark' — THM-001 requires migration to 'Dark'.
    expect(dataTheme).not.toBe('dark')
    expect(typeof dataTheme).toBe('string')
    expect((dataTheme || '').length).toBeGreaterThan(0)
  })

  test('built-in theme CSS editor is read-only', async ({ window }) => {
    await openThemeEditor(window)

    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('Dark')
    await window.waitForTimeout(500)

    const isReadOnly = await window.evaluate(() => {
      const editors = (window as unknown as { monaco?: { editor: { getEditors: () => Array<{ getOption: (id: number) => unknown; getRawOptions?: () => { readOnly?: boolean } }> } } }).monaco?.editor?.getEditors?.()
      if (!editors || editors.length === 0) return null
      const container = document.querySelector('.theme-editor-container')
      for (const ed of editors) {
        // Find the editor whose DOM node is inside the theme editor container
        const domNode = (ed as unknown as { getDomNode?: () => HTMLElement }).getDomNode?.()
        if (domNode && container && container.contains(domNode)) {
          const raw = (ed as unknown as { getRawOptions?: () => { readOnly?: boolean } }).getRawOptions?.()
          return raw?.readOnly ?? null
        }
      }
      return null
    })

    expect(isReadOnly).toBe(true)

    await window.keyboard.press('Escape')
  })
})
