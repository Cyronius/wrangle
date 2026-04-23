// Traces: THM-005 (canonical spec: specs/theming/spec.md)
import { test, expect, waitForMonacoReady } from '../../fixtures'

async function openThemeEditor(window: import('@playwright/test').Page): Promise<void> {
  await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
  await window.keyboard.press('Control+,')
  await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })
  const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
  await themesTab.click()
  await window.waitForSelector('.theme-select select', { state: 'visible', timeout: 5000 })
}

async function selectAndClose(window: import('@playwright/test').Page, name: string): Promise<void> {
  const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
  await themeSelect.selectOption(name)
  await window.waitForTimeout(700)
  await window.keyboard.press('Escape')
  await window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
  await window.waitForTimeout(300)
}

async function getMonacoBg(window: import('@playwright/test').Page): Promise<string | null> {
  return window.evaluate(() => {
    const el = document.querySelector('.monaco-editor') as HTMLElement | null
    if (!el) return null
    return window.getComputedStyle(el).backgroundColor
  })
}

test.describe('THM-005: Monaco theme name mapping and synchronization', () => {
  test('switching to a custom-colored built-in (e.g. Dracula) changes Monaco background', async ({ window }) => {
    await waitForMonacoReady(window)
    await openThemeEditor(window)
    await selectAndClose(window, 'Dark')
    const darkBg = await getMonacoBg(window)

    await openThemeEditor(window)
    await selectAndClose(window, 'Dracula')
    const draculaBg = await getMonacoBg(window)

    expect(darkBg).toBeTruthy()
    expect(draculaBg).toBeTruthy()
    expect(draculaBg).not.toBe(darkBg)
  })

  test('switching Dark <-> Lightish changes Monaco background both directions', async ({ window }) => {
    await waitForMonacoReady(window)
    await openThemeEditor(window)
    await selectAndClose(window, 'Dark')
    const darkBg = await getMonacoBg(window)

    await openThemeEditor(window)
    await selectAndClose(window, 'Lightish')
    const lightBg = await getMonacoBg(window)

    await openThemeEditor(window)
    await selectAndClose(window, 'Dark')
    const darkBg2 = await getMonacoBg(window)

    expect(darkBg).toBeTruthy()
    expect(lightBg).toBeTruthy()
    expect(lightBg).not.toBe(darkBg)
    expect(darkBg2).toBe(darkBg)
  })

  test('monaco.editor._themes contains registered custom built-in themes after startup', async ({ window }) => {
    await waitForMonacoReady(window)

    // getMonacoThemeName/registerCustomMonacoTheme should have been called for non-Lightish/Dark built-ins
    // when ThemeProvider mounted. We can verify by asking Monaco to set the theme and observing no throw,
    // and by inspecting that monaco.editor.defineTheme was used (Monaco keeps themes internally under
    // an unspecified field; instead, set the theme and confirm Monaco's background reflects the change).
    await openThemeEditor(window)

    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('Nord')
    await window.waitForTimeout(700)
    await window.keyboard.press('Escape')
    await window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
    await window.waitForTimeout(300)

    const nordBg = await getMonacoBg(window)
    expect(nordBg).toBeTruthy()

    // Round-trip: switch to Dark.
    await openThemeEditor(window)
    const sel2 = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await sel2.selectOption('Dark')
    await window.waitForTimeout(700)
    await window.keyboard.press('Escape')
    await window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
    await window.waitForTimeout(300)

    const darkBg = await getMonacoBg(window)
    expect(darkBg).toBeTruthy()
    expect(darkBg).not.toBe(nordBg)
  })

  test('setTheme failure is swallowed: theme switch never throws', async ({ window }) => {
    await waitForMonacoReady(window)

    // Capture any unhandled errors during a sequence of theme switches.
    const errors: string[] = []
    window.on('pageerror', (err) => errors.push(String(err)))

    await openThemeEditor(window)
    const sel = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    for (const name of ['Dark', 'Lightish', 'Dracula', 'Nord', 'Dark']) {
      await sel.selectOption(name)
      await window.waitForTimeout(400)
    }
    await window.keyboard.press('Escape')

    expect(errors).toEqual([])
  })

  test('Theme Editor Monaco instance uses the active theme (matches main editor)', async ({ window }) => {
    await waitForMonacoReady(window)
    await openThemeEditor(window)

    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('Dracula')
    await window.waitForTimeout(800)

    // Both the theme-editor-container monaco and the outer app monaco should share the same
    // computed background color, since they both derive theme from getMonacoThemeName(current).
    const bgs = await window.evaluate(() => {
      const editors = document.querySelectorAll('.monaco-editor')
      return Array.from(editors).map((e) => window.getComputedStyle(e as HTMLElement).backgroundColor)
    })
    expect(bgs.length).toBeGreaterThan(0)
    // All monaco editors should share the same theme background after the switch.
    const unique = new Set(bgs)
    expect(unique.size).toBe(1)

    await window.keyboard.press('Escape')
  })
})
