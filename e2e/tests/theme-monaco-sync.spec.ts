import { test, expect, waitForMonacoReady } from '../fixtures'

test.describe('Theme Monaco Sync', () => {
  test('selecting a theme in preferences should immediately update Monaco editor', async ({ window }) => {
    // Wait for app and Monaco to be ready
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
    await waitForMonacoReady(window)

    // First, set a known baseline theme (dark)
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })
    const themesTabInit = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTabInit.click()
    await window.waitForTimeout(500)
    const themeSelectInit = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelectInit.selectOption('dark')
    await window.waitForTimeout(1000)
    await window.keyboard.press('Escape')
    await window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
    await window.waitForTimeout(500)

    // Get baseline Monaco editor background color (dark theme)
    const initialBg = await window.evaluate(() => {
      const editorElement = document.querySelector('.monaco-editor') as HTMLElement
      if (!editorElement) return null
      return window.getComputedStyle(editorElement).backgroundColor
    })
    expect(initialBg).toBeTruthy()

    // Open Preferences again
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })

    const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTab.click()
    await window.waitForTimeout(500)

    // Select Dracula theme (has a distinctly different background: #282a36)
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('Dracula')
    await window.waitForTimeout(1000)

    // Close preferences
    await window.keyboard.press('Escape')
    await window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
    await window.waitForTimeout(500)

    // Get Monaco editor background color after theme change
    const newBg = await window.evaluate(() => {
      const editorElement = document.querySelector('.monaco-editor') as HTMLElement
      if (!editorElement) return null
      return window.getComputedStyle(editorElement).backgroundColor
    })

    // The Monaco editor background should have changed
    expect(newBg).toBeTruthy()
    expect(newBg).not.toBe(initialBg)
  })

  test('theme change should update Monaco without reopening preferences', async ({ window }) => {
    // Wait for app and Monaco to be ready
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
    await waitForMonacoReady(window)

    // Open Preferences
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })

    // Ensure themes tab is active
    const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTab.click()
    await window.waitForTimeout(500)

    // First set to dark theme to establish baseline
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('dark')
    await window.waitForTimeout(500)

    // Close preferences
    await window.keyboard.press('Escape')
    await window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
    await window.waitForTimeout(500)

    // Get baseline Monaco bg
    const darkBg = await window.evaluate(() => {
      const editorElement = document.querySelector('.monaco-editor') as HTMLElement
      if (!editorElement) return null
      return window.getComputedStyle(editorElement).backgroundColor
    })

    // Open preferences again and switch to Nord
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })
    const themesTab2 = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTab2.click()
    await window.waitForTimeout(500)

    const themeSelect2 = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect2.selectOption('Nord')
    await window.waitForTimeout(1000)

    // Close preferences
    await window.keyboard.press('Escape')
    await window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
    await window.waitForTimeout(500)

    // Monaco should reflect Nord theme, NOT still be on dark
    const nordBg = await window.evaluate(() => {
      const editorElement = document.querySelector('.monaco-editor') as HTMLElement
      if (!editorElement) return null
      return window.getComputedStyle(editorElement).backgroundColor
    })

    expect(nordBg).toBeTruthy()
    expect(nordBg).not.toBe(darkBg)
  })

  test('switching themes multiple times should update Monaco each time', async ({ window }) => {
    // Wait for app and Monaco to be ready
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
    await waitForMonacoReady(window)

    // Helper to switch theme and get Monaco background color
    async function switchThemeAndGetBg(themeName: string): Promise<string | null> {
      await window.keyboard.press('Control+,')
      await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })
      const tab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
      await tab.click()
      await window.waitForTimeout(500)
      const select = await window.waitForSelector('.theme-select select', { timeout: 3000 })
      await select.selectOption(themeName)
      await window.waitForTimeout(1000)
      await window.keyboard.press('Escape')
      await window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
      await window.waitForTimeout(500)

      return window.evaluate(() => {
        const editorElement = document.querySelector('.monaco-editor') as HTMLElement
        if (!editorElement) return null
        return window.getComputedStyle(editorElement).backgroundColor
      })
    }

    // Switch 1: Set baseline to dark
    const darkBg = await switchThemeAndGetBg('dark')
    expect(darkBg).toBeTruthy()

    // Switch 2: dark -> Dracula
    const draculaBg = await switchThemeAndGetBg('Dracula')
    expect(draculaBg).toBeTruthy()
    expect(draculaBg).not.toBe(darkBg)

    // Switch 3: Dracula -> Nord
    const nordBg = await switchThemeAndGetBg('Nord')
    expect(nordBg).toBeTruthy()
    expect(nordBg).not.toBe(draculaBg)

    // Switch 4: Nord -> Lightish
    const lightBg = await switchThemeAndGetBg('Lightish')
    expect(lightBg).toBeTruthy()
    expect(lightBg).not.toBe(nordBg)

    // Switch 5: Lightish -> dark (round-trip: should match original dark)
    const darkBg2 = await switchThemeAndGetBg('dark')
    expect(darkBg2).toBeTruthy()
    expect(darkBg2).not.toBe(lightBg)
    expect(darkBg2).toBe(darkBg)
  })
})
