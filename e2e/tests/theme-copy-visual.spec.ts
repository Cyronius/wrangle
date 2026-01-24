import { test, expect } from '../fixtures'

test.describe('Theme Copy Visual Verification', () => {
  test('copying light theme should apply light-colored CSS variables', async ({ window }) => {
    // Wait for app to be ready (title bar or tab bar visible)
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
    const uniqueName = `light-visual-${Date.now()}`

    // Open Preferences
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })

    // Switch to Theme Editor tab
    const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTab.click()
    await window.waitForTimeout(500)

    // First switch to 'light' built-in theme
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('light')
    await window.waitForTimeout(500)

    // Verify we're on the light theme and it has light styles applied
    const lightBg = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    })
    console.log(`Light theme --app-bg: "${lightBg}"`)
    // Light theme uses #faf8f5 for --app-bg
    expect(lightBg).toBe('#faf8f5')

    // Now copy the light theme
    await window.click('button:has-text("Copy Theme")')
    await window.waitForSelector('.name-modal', { state: 'visible', timeout: 3000 })

    // Type a unique name
    const nameInput = await window.waitForSelector('.name-modal input[type="text"]', { timeout: 3000 })
    await nameInput.click({ clickCount: 3 })
    await window.keyboard.type(uniqueName)

    // Create the copy
    await window.click('.name-modal button:has-text("Create")')
    await window.waitForSelector('.name-modal-overlay', { state: 'hidden', timeout: 5000 })
    await window.waitForTimeout(1000)

    // Verify the dropdown switched to the new theme
    const selectedTheme = await window.$eval('.theme-select select', (el: HTMLSelectElement) => el.value)
    expect(selectedTheme).toBe(uniqueName)

    // Now check the COMPUTED styles - this is the actual visual verification
    const debugInfo = await window.evaluate(() => {
      const root = document.documentElement
      const computedStyle = getComputedStyle(root)
      return {
        dataTheme: root.getAttribute('data-theme'),
        appBg: computedStyle.getPropertyValue('--app-bg').trim(),
        textColor: computedStyle.getPropertyValue('--text-color').trim(),
        tabBarBg: computedStyle.getPropertyValue('--tab-bar-bg').trim(),
        previewBg: computedStyle.getPropertyValue('--preview-bg').trim(),
        // Check what style elements exist
        customThemeActive: document.getElementById('custom-theme-active')?.textContent?.substring(0, 100) || null,
        customThemeNamed: (() => {
          const styles = document.querySelectorAll('style[id^="custom-theme-"]')
          return Array.from(styles).map(s => ({ id: s.id, contentPreview: s.textContent?.substring(0, 100) || '' }))
        })()
      }
    })

    console.log('Debug info after copy:', JSON.stringify(debugInfo, null, 2))

    // The copied light theme should have light-colored values
    expect(debugInfo.dataTheme).toBe(uniqueName)
    expect(debugInfo.appBg).toBe('#faf8f5')  // Light theme value, NOT dark (#1e1e1e)
    expect(debugInfo.textColor).toBe('#1a1a1a')  // Light theme text color
    expect(debugInfo.previewBg).toBe('#faf8f5')  // Light preview bg

    // Close preferences
    await window.keyboard.press('Escape')
  })

  test('copying a custom light-based theme should also apply light styles', async ({ window }) => {
    // Wait for app to be ready
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
    const baseCopy = `light-base-${Date.now()}`
    const secondCopy = `light-copy2-${Date.now()}`

    // Open Preferences
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })

    // Switch to Theme Editor tab
    const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTab.click()
    await window.waitForTimeout(500)

    // Switch to light built-in theme
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('light')
    await window.waitForTimeout(500)

    // Create first copy of light theme
    await window.click('button:has-text("Copy Theme")')
    await window.waitForSelector('.name-modal', { state: 'visible', timeout: 3000 })
    const nameInput1 = await window.waitForSelector('.name-modal input[type="text"]', { timeout: 3000 })
    await nameInput1.click({ clickCount: 3 })
    await window.keyboard.type(baseCopy)
    await window.click('.name-modal button:has-text("Create")')
    await window.waitForSelector('.name-modal-overlay', { state: 'hidden', timeout: 5000 })
    await window.waitForTimeout(1000)

    // Verify first copy has light styles
    const firstCopyBg = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    })
    console.log(`First copy --app-bg: "${firstCopyBg}"`)
    expect(firstCopyBg).toBe('#faf8f5')

    // Now we're on the first copy (a custom theme). Copy IT to make a second-level copy.
    await window.click('button:has-text("Copy Theme")')
    await window.waitForSelector('.name-modal', { state: 'visible', timeout: 3000 })
    const nameInput2 = await window.waitForSelector('.name-modal input[type="text"]', { timeout: 3000 })
    await nameInput2.click({ clickCount: 3 })
    await window.keyboard.type(secondCopy)
    await window.click('.name-modal button:has-text("Create")')
    await window.waitForSelector('.name-modal-overlay', { state: 'hidden', timeout: 5000 })
    await window.waitForTimeout(1000)

    // Verify the second copy ALSO has light styles
    const debugInfo = await window.evaluate(() => {
      const root = document.documentElement
      const computedStyle = getComputedStyle(root)
      return {
        dataTheme: root.getAttribute('data-theme'),
        appBg: computedStyle.getPropertyValue('--app-bg').trim(),
        textColor: computedStyle.getPropertyValue('--text-color').trim(),
        previewBg: computedStyle.getPropertyValue('--preview-bg').trim(),
        customThemeStyles: (() => {
          const styles = document.querySelectorAll('style[id^="custom-theme-"]')
          return Array.from(styles).map(s => ({ id: s.id, contentPreview: s.textContent?.substring(0, 200) || '' }))
        })()
      }
    })

    console.log('Second copy debug info:', JSON.stringify(debugInfo, null, 2))

    expect(debugInfo.dataTheme).toBe(secondCopy)
    expect(debugInfo.appBg).toBe('#faf8f5')  // Should be light, NOT dark
    expect(debugInfo.textColor).toBe('#1a1a1a')
    expect(debugInfo.previewBg).toBe('#faf8f5')

    // Close preferences
    await window.keyboard.press('Escape')
  })

  test('switching to dark then copying light should use light CSS', async ({ window }) => {
    // This tests the scenario where the app starts with dark theme,
    // user switches to light, then copies it
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
    const uniqueName = `switch-copy-${Date.now()}`

    // Open Preferences
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })

    // Switch to Theme Editor tab
    const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTab.click()
    await window.waitForTimeout(500)

    // Start on dark theme explicitly
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('dark')
    await window.waitForTimeout(500)

    // Verify dark is active
    const darkBg = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    })
    console.log(`Dark theme --app-bg: "${darkBg}"`)
    expect(darkBg).toBe('#1e1e1e')

    // Now switch to light
    await themeSelect.selectOption('light')
    await window.waitForTimeout(500)

    // Verify light is active
    const lightBg = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    })
    console.log(`After switching to light --app-bg: "${lightBg}"`)
    expect(lightBg).toBe('#faf8f5')

    // Copy the light theme
    await window.click('button:has-text("Copy Theme")')
    await window.waitForSelector('.name-modal', { state: 'visible', timeout: 3000 })
    const nameInput = await window.waitForSelector('.name-modal input[type="text"]', { timeout: 3000 })
    await nameInput.click({ clickCount: 3 })
    await window.keyboard.type(uniqueName)
    await window.click('.name-modal button:has-text("Create")')
    await window.waitForSelector('.name-modal-overlay', { state: 'hidden', timeout: 5000 })
    await window.waitForTimeout(1000)

    // Check computed styles
    const debugInfo = await window.evaluate(() => {
      const root = document.documentElement
      const computedStyle = getComputedStyle(root)
      return {
        dataTheme: root.getAttribute('data-theme'),
        appBg: computedStyle.getPropertyValue('--app-bg').trim(),
        textColor: computedStyle.getPropertyValue('--text-color').trim(),
        customThemeStyles: (() => {
          const styles = document.querySelectorAll('style[id^="custom-theme-"]')
          return Array.from(styles).map(s => ({ id: s.id, contentPreview: s.textContent?.substring(0, 200) || '' }))
        })()
      }
    })

    console.log('Switch then copy debug:', JSON.stringify(debugInfo, null, 2))

    expect(debugInfo.appBg).toBe('#faf8f5')
    expect(debugInfo.textColor).toBe('#1a1a1a')

    // Close preferences
    await window.keyboard.press('Escape')
  })

  test('theme should remain light-styled after waiting for all effects to settle', async ({ window }) => {
    // This tests whether the theme is still correct after React effects have settled
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
    const uniqueName = `settle-${Date.now()}`

    // Open Preferences
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })

    // Switch to Theme Editor tab
    const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTab.click()
    await window.waitForTimeout(500)

    // Switch to light
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('light')
    await window.waitForTimeout(500)

    // Copy it
    await window.click('button:has-text("Copy Theme")')
    await window.waitForSelector('.name-modal', { state: 'visible', timeout: 3000 })
    const nameInput = await window.waitForSelector('.name-modal input[type="text"]', { timeout: 3000 })
    await nameInput.click({ clickCount: 3 })
    await window.keyboard.type(uniqueName)
    await window.click('.name-modal button:has-text("Create")')
    await window.waitForSelector('.name-modal-overlay', { state: 'hidden', timeout: 5000 })

    // Check immediately
    const immediate = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    })
    console.log(`Immediately after create: --app-bg = "${immediate}"`)

    // Wait 500ms for React effects
    await window.waitForTimeout(500)
    const after500 = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    })
    console.log(`After 500ms: --app-bg = "${after500}"`)

    // Wait 2 more seconds (for debounced saves, async thunks, etc.)
    await window.waitForTimeout(2000)
    const after2500 = await window.evaluate(() => {
      const root = document.documentElement
      const computedStyle = getComputedStyle(root)
      return {
        dataTheme: root.getAttribute('data-theme'),
        appBg: computedStyle.getPropertyValue('--app-bg').trim(),
        styleElements: (() => {
          const styles = document.querySelectorAll('style[id^="custom-theme-"]')
          return Array.from(styles).map(s => ({
            id: s.id,
            hasContent: (s.textContent?.length || 0) > 0,
            selectorMatch: s.textContent?.includes(`data-theme='${root.getAttribute('data-theme')}'`) || false
          }))
        })()
      }
    })
    console.log(`After 2500ms:`, JSON.stringify(after2500, null, 2))

    expect(immediate).toBe('#faf8f5')
    expect(after500).toBe('#faf8f5')
    expect(after2500.appBg).toBe('#faf8f5')
    expect(after2500.styleElements.length).toBeGreaterThan(0)
    expect(after2500.styleElements.some((s: { selectorMatch: boolean; hasContent: boolean }) => s.selectorMatch && s.hasContent)).toBe(true)

    // Close preferences
    await window.keyboard.press('Escape')
  })

  test('copying a custom theme before it is fully loaded should not produce dark CSS', async ({ window }) => {
    // This tests the scenario where customThemes might not be loaded yet
    // or where currentCSS could be empty, causing fallback to dark template
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
    const baseCopy = `preload-${Date.now()}`
    const secondCopy = `preload2-${Date.now()}`

    // Open Preferences
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })

    // Switch to Theme Editor tab
    const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTab.click()
    await window.waitForTimeout(500)

    // Switch to light and create a copy
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('light')
    await window.waitForTimeout(500)

    await window.click('button:has-text("Copy Theme")')
    await window.waitForSelector('.name-modal', { state: 'visible', timeout: 3000 })
    const nameInput1 = await window.waitForSelector('.name-modal input[type="text"]', { timeout: 3000 })
    await nameInput1.click({ clickCount: 3 })
    await window.keyboard.type(baseCopy)
    await window.click('.name-modal button:has-text("Create")')
    await window.waitForSelector('.name-modal-overlay', { state: 'hidden', timeout: 5000 })
    await window.waitForTimeout(500)

    // Now simulate what happens if we try to copy this custom theme
    // but the CSS in the editor is what matters - check what copySourceCSS would be
    const editorCSS = await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors && editors.length > 0) {
        return editors[editors.length - 1]?.getValue() || ''
      }
      return ''
    })
    console.log(`Custom theme editor CSS starts with: "${editorCSS.substring(0, 100)}"`)

    // The editor should show the light-themed CSS
    expect(editorCSS).toContain('#faf8f5')
    expect(editorCSS).not.toContain('#1e1e1e')

    // Now copy this custom theme
    await window.click('button:has-text("Copy Theme")')
    await window.waitForSelector('.name-modal', { state: 'visible', timeout: 3000 })
    const nameInput2 = await window.waitForSelector('.name-modal input[type="text"]', { timeout: 3000 })
    await nameInput2.click({ clickCount: 3 })
    await window.keyboard.type(secondCopy)
    await window.click('.name-modal button:has-text("Create")')
    await window.waitForSelector('.name-modal-overlay', { state: 'hidden', timeout: 5000 })
    await window.waitForTimeout(1000)

    // Check: the new theme's CSS should NOT have dark colors
    const newThemeCSS = await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors && editors.length > 0) {
        return editors[editors.length - 1]?.getValue() || ''
      }
      return ''
    })
    console.log(`Second copy CSS starts with: "${newThemeCSS.substring(0, 100)}"`)

    // Critical: the copied CSS should have light values, not dark template
    expect(newThemeCSS).toContain('#faf8f5')
    expect(newThemeCSS).not.toContain('#1e1e1e')

    // Also check computed styles
    const appBg = await window.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--app-bg').trim()
    })
    expect(appBg).toBe('#faf8f5')

    // Close preferences
    await window.keyboard.press('Escape')
  })
})
