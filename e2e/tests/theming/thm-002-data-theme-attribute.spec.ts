// Traces: THM-002 (canonical spec: specs/theming/spec.md)
import { test, expect } from '../../fixtures'

async function openThemeEditor(window: import('@playwright/test').Page): Promise<void> {
  await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
  await window.keyboard.press('Control+,')
  await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })
  const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
  await themesTab.click()
  await window.waitForSelector('.theme-select select', { state: 'visible', timeout: 5000 })
}

test.describe('THM-002: data-theme attribute drives CSS variable overrides', () => {
  test('switching to Dark sets data-theme="Dark" and yields dark --app-bg', async ({ window }) => {
    await openThemeEditor(window)

    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('Dark')
    await window.waitForTimeout(500)

    const result = await window.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute('data-theme'),
      appBg: getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    }))

    expect(result.dataTheme).toBe('Dark')
    expect(result.appBg).toBe('#1e1e1e')

    await window.keyboard.press('Escape')
  })

  test('switching to Lightish sets data-theme="Lightish" and yields light --app-bg', async ({ window }) => {
    await openThemeEditor(window)

    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('Lightish')
    await window.waitForTimeout(500)

    const result = await window.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute('data-theme'),
      appBg: getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    }))

    expect(result.dataTheme).toBe('Lightish')
    expect(result.appBg).toBe('#faf8f5')

    await window.keyboard.press('Escape')
  })

  test('only one data-theme value is active at a time and it toggles cleanly', async ({ window }) => {
    await openThemeEditor(window)

    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })

    await themeSelect.selectOption('Dark')
    await window.waitForTimeout(400)
    const afterDark = await window.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute('data-theme'),
      appBg: getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    }))

    await themeSelect.selectOption('Lightish')
    await window.waitForTimeout(400)
    const afterLight = await window.evaluate(() => ({
      dataTheme: document.documentElement.getAttribute('data-theme'),
      appBg: getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    }))

    expect(afterDark.dataTheme).toBe('Dark')
    expect(afterLight.dataTheme).toBe('Lightish')
    expect(afterDark.appBg).not.toBe(afterLight.appBg)

    await window.keyboard.press('Escape')
  })

  test('custom theme CSS uses :root[data-theme="<name>"] selector so attribute swap applies it', async ({ window }) => {
    await openThemeEditor(window)

    // Ensure we start from a known built-in.
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('Dark')
    await window.waitForTimeout(400)

    // Copy the current theme to create a custom one.
    const copyBtn = await window.waitForSelector('.theme-name-edit-btn.copy', { timeout: 3000 })
    await copyBtn.click()
    await window.waitForTimeout(800)

    const result = await window.evaluate(() => {
      const dataTheme = document.documentElement.getAttribute('data-theme')
      const style = document.getElementById('custom-theme-active')
      const css = style?.textContent || ''
      const selectorOk = !!dataTheme && css.includes(`:root[data-theme='${dataTheme}']`)
      return { dataTheme, hasStyle: !!style, selectorOk }
    })

    expect(result.hasStyle).toBe(true)
    expect(result.dataTheme).toBeTruthy()
    expect(result.selectorOk).toBe(true)

    await window.keyboard.press('Escape')
  })
})
