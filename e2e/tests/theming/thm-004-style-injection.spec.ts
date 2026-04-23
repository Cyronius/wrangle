// Traces: THM-004 (canonical spec: specs/theming/spec.md)
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

test.describe('THM-004: Active custom theme injection via <style id="custom-theme-active">', () => {
  test('activating a custom theme creates/updates <style id="custom-theme-active"> with its CSS', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')
    const newName = await copyCurrent(window)

    const info = await window.evaluate(() => {
      const style = document.getElementById('custom-theme-active') as HTMLStyleElement | null
      return {
        exists: !!style,
        tag: style?.tagName ?? null,
        hasText: (style?.textContent?.length ?? 0) > 0,
        text: style?.textContent ?? ''
      }
    })
    expect(info.exists).toBe(true)
    expect(info.tag).toBe('STYLE')
    expect(info.hasText).toBe(true)
    expect(info.text).toContain(`:root[data-theme='${newName}']`)

    await window.keyboard.press('Escape')
  })

  test('switching back to a built-in theme removes custom-theme-active style element', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')
    await copyCurrent(window)

    // custom-theme-active should exist now.
    expect(await window.evaluate(() => !!document.getElementById('custom-theme-active'))).toBe(true)

    // Switch back to a built-in.
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('Lightish')
    await window.waitForTimeout(500)

    const hasCustom = await window.evaluate(() => !!document.getElementById('custom-theme-active'))
    expect(hasCustom).toBe(false)

    const dataTheme = await window.evaluate(() => document.documentElement.getAttribute('data-theme'))
    expect(dataTheme).toBe('Lightish')

    await window.keyboard.press('Escape')
  })

  test('at most one <style id="custom-theme-active"> exists across theme switches', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')
    const firstCopy = await copyCurrent(window)

    // Switch to another built-in and back, and make another custom copy.
    await selectBuiltin(window, 'Lightish')
    const secondCopy = await copyCurrent(window)

    const count = await window.evaluate(() =>
      document.querySelectorAll('style#custom-theme-active').length
    )
    expect(count).toBe(1)

    const text = await window.evaluate(() => document.getElementById('custom-theme-active')?.textContent || '')
    // The only active style must match the currently-active custom theme.
    expect(text).toContain(`:root[data-theme='${secondCopy}']`)
    expect(firstCopy).toBeTruthy()

    await window.keyboard.press('Escape')
  })

  test('data-theme attribute and injected CSS always refer to the same theme', async ({ window }) => {
    await openThemeEditor(window)
    await selectBuiltin(window, 'Dark')
    const newName = await copyCurrent(window)

    const result = await window.evaluate(() => {
      const dataTheme = document.documentElement.getAttribute('data-theme')
      const style = document.getElementById('custom-theme-active')
      const css = style?.textContent || ''
      return { dataTheme, cssMatchesDataTheme: !!dataTheme && css.includes(`:root[data-theme='${dataTheme}']`) }
    })

    expect(result.dataTheme).toBe(newName)
    expect(result.cssMatchesDataTheme).toBe(true)

    await window.keyboard.press('Escape')
  })
})
