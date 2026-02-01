import { test, expect, waitForMonacoReady } from '../fixtures'

test.describe('Theme Rapid Switching', () => {
  test('rapid theme switching in open preferences should update Monaco each time (10 switches)', async ({ window }) => {
    // Wait for app and Monaco to be ready
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
    await waitForMonacoReady(window)

    // Open Preferences once
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })

    // Navigate to Theme Editor tab
    const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTab.click()
    await window.waitForTimeout(500)

    // Define a rotation of themes alternating between dark and light backgrounds
    // to ensure each consecutive switch produces a visibly different color
    const themeSequence = [
      'dark',             // #1e1e1e (dark)
      'Lightish',         // #faf8f5 (light) - vs built-in
      'Solarized Dark',   // #002b36 (dark)
      'Solarized Light',  // #fdf6e3 (light)
      'Night Owl',        // #011627 (dark)
      'Lightish',         // #faf8f5 (light)
      'Tokyo Night',      // #1a1b26 (dark)
      'Nord',             // #2e3440 (dark)
      'Dracula',          // #282a36 (dark)
      'dark',             // #1e1e1e (dark)
    ]

    let previousBg: string | null = null
    const backgrounds: string[] = []

    for (let i = 0; i < themeSequence.length; i++) {
      const themeName = themeSequence[i]

      // Select the theme in the dropdown (do NOT close/reopen preferences)
      const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
      await themeSelect.selectOption(themeName)

      // Wait for theme to apply
      await window.waitForTimeout(1500)

      // Get the MAIN Monaco editor background color (not the CSS editor inside preferences)
      const currentBg = await window.evaluate(() => {
        const editors = document.querySelectorAll('.monaco-editor')
        for (const editor of editors) {
          // Skip editors inside the preferences dialog
          if (!editor.closest('.preferences-dialog')) {
            return window.getComputedStyle(editor as HTMLElement).backgroundColor
          }
        }
        return null
      })

      expect(currentBg, `Switch ${i + 1} to "${themeName}": Monaco editor background should be present`).toBeTruthy()
      backgrounds.push(currentBg!)

      // Each switch should produce a different background than the previous
      if (previousBg !== null) {
        expect(currentBg, `Switch ${i + 1} to "${themeName}": background should differ from previous (was: ${previousBg}, got: ${currentBg})`).not.toBe(previousBg)
      }

      previousBg = currentBg
    }

    // Verify round-trip: both 'dark' entries (index 0 and 9) should have the same background
    expect(backgrounds[9]).toBe(backgrounds[0])

    // Close preferences at the end
    await window.keyboard.press('Escape')
    await window.waitForSelector('.preferences-dialog', { state: 'hidden', timeout: 3000 })
  })
})
