import { test, expect, waitForMonacoReady } from '../fixtures'

test.describe('Theme Copy and Edit', () => {
  test('editing a copied theme should not modify the original', async ({ window, electronApp }) => {
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
    const uniqueName = `test-copy-${Date.now()}`

    // Open Preferences with Ctrl+,
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })

    // Switch to Themes tab
    const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTab.click()
    await window.waitForTimeout(500)

    // Ensure we're on dark theme (settings may persist between runs)
    const themeSelectInit = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelectInit.selectOption('dark')
    await window.waitForTimeout(500)

    // Copy the dark theme.
    await window.click('button:has-text("Copy Theme")')
    await window.waitForSelector('.name-modal', { state: 'visible', timeout: 3000 })

    // Use a unique name to avoid conflicts with persisted settings
    const nameInput = await window.waitForSelector('.name-modal input[type="text"]', { timeout: 3000 })
    await nameInput.click({ clickCount: 3 })
    await window.keyboard.type(uniqueName)

    // Create the copy
    await window.click('.name-modal button:has-text("Create")')
    await window.waitForSelector('.name-modal-overlay', { state: 'hidden', timeout: 5000 })
    await window.waitForTimeout(500)

    // Verify we switched to the copied theme
    const selectedTheme = await window.$eval('.theme-select select', (el: HTMLSelectElement) => el.value)
    expect(selectedTheme).toBe(uniqueName)

    // Edit the copied theme's CSS by changing a color value (keeps CSS valid)
    await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors && editors.length > 0) {
        const editor = editors[editors.length - 1]
        const model = editor.getModel()
        if (model) {
          const content = model.getValue()
          model.setValue(content.replace('--accent-color: #4daafc', '--accent-color: #abcdef'))
        }
      }
    })
    // Trigger onChange by typing a space in the editor
    const editorArea = await window.waitForSelector('.theme-editor-container .monaco-editor .view-lines', { timeout: 5000 })
    await editorArea.click()
    await window.waitForTimeout(300)
    await window.keyboard.press('End')
    await window.keyboard.type(' ')
    await window.waitForTimeout(3000) // Wait for debounced save (1500ms + buffer)

    // Now switch back to the original theme (dark)
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('dark')
    await window.waitForTimeout(1000)

    // Get the original theme's CSS - it should NOT contain our edit
    const darkCSS = await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors && editors.length > 0) {
        return editors[editors.length - 1].getValue()
      }
      return ''
    })

    expect(darkCSS).not.toContain('#abcdef')

    // Switch back to the copy and verify the edit is still there
    await themeSelect.selectOption(uniqueName)
    await window.waitForTimeout(1500)

    const editedCSS = await window.evaluate(() => {
      const container = document.querySelector('.theme-editor-container')
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (container && editors) {
        for (const editor of editors) {
          if (container.contains(editor.getDomNode())) {
            return editor.getValue()
          }
        }
      }
      if (editors && editors.length > 0) {
        return editors[editors.length - 1].getValue()
      }
      return ''
    })

    expect(editedCSS).toContain('#abcdef')

    // Close preferences
    await window.keyboard.press('Escape')
  })

  test('editing copied theme via typing should save to the copy, not the source', async ({ window, electronApp }) => {
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
    const uniqueName = `typed-copy-${Date.now()}`

    // Open Preferences
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })

    // Switch to Themes tab
    const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTab.click()
    await window.waitForTimeout(500)

    // Ensure we're on dark
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('dark')
    await window.waitForTimeout(500)

    // Copy the dark theme
    await window.click('button:has-text("Copy Theme")')
    await window.waitForSelector('.name-modal', { state: 'visible', timeout: 3000 })

    const nameInput = await window.waitForSelector('.name-modal input[type="text"]', { timeout: 3000 })
    await nameInput.click({ clickCount: 3 })
    await window.keyboard.type(uniqueName)
    await window.click('.name-modal button:has-text("Create")')
    await window.waitForSelector('.name-modal-overlay', { state: 'hidden', timeout: 5000 })
    await window.waitForTimeout(500)

    // Verify we're on the copy
    const selected = await window.$eval('.theme-select select', (el: HTMLSelectElement) => el.value)
    expect(selected).toBe(uniqueName)

    // Modify a CSS property value via Monaco API to ensure valid CSS
    await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors && editors.length > 0) {
        const editor = editors[editors.length - 1]
        const model = editor.getModel()
        if (model) {
          const content = model.getValue()
          model.setValue(content.replace('--app-bg: #1e1e1e', '--app-bg: #ff0000'))
        }
      }
    })
    // Trigger the onChange handler by typing in the editor
    const editorArea = await window.waitForSelector('.theme-editor-container .monaco-editor .view-lines', { timeout: 5000 })
    await editorArea.click()
    await window.waitForTimeout(300)
    await window.keyboard.press('End')
    await window.keyboard.type(' ')

    // Wait for the debounced save to fire (1500ms debounce + buffer)
    await window.waitForTimeout(3000)

    // Now check: switch to dark and verify it was NOT modified
    await themeSelect.selectOption('dark')
    await window.waitForTimeout(1500)

    // Read the theme editor's current value
    const darkCSSAfter = await window.evaluate(() => {
      const container = document.querySelector('.theme-editor-container')
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (container && editors) {
        for (const editor of editors) {
          if (container.contains(editor.getDomNode())) {
            return editor.getValue()
          }
        }
      }
      if (editors && editors.length > 0) {
        return editors[editors.length - 1]?.getValue() || ''
      }
      return ''
    })

    // The dark theme should NOT contain our edit
    expect(darkCSSAfter).not.toContain('#ff0000')

    // Switch back to the copy and verify the edit IS there
    await themeSelect.selectOption(uniqueName)
    await window.waitForTimeout(1500)

    const copyCSS = await window.evaluate(() => {
      const container = document.querySelector('.theme-editor-container')
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (container && editors) {
        for (const editor of editors) {
          if (container.contains(editor.getDomNode())) {
            return editor.getValue()
          }
        }
      }
      if (editors && editors.length > 0) {
        return editors[editors.length - 1].getValue()
      }
      return ''
    })

    expect(copyCSS).toContain('#ff0000')

    // Close preferences
    await window.keyboard.press('Escape')
  })

  test('making two copies from the same source should be independent', async ({ window, electronApp }) => {
    await window.waitForSelector('.title-bar, .tab-bar', { state: 'visible', timeout: 30000 })
    const copyName1 = `copy-a-${Date.now()}`
    const copyName2 = `copy-b-${Date.now()}`

    // Open Preferences
    await window.keyboard.press('Control+,')
    await window.waitForSelector('.preferences-dialog', { state: 'visible', timeout: 5000 })

    // Switch to Themes tab
    const themesTab = await window.waitForSelector('.preferences-tab:has-text("Theme Editor")', { timeout: 5000 })
    await themesTab.click()
    await window.waitForTimeout(500)

    // Ensure we're on 'dark'
    const themeSelect = await window.waitForSelector('.theme-select select', { timeout: 3000 })
    await themeSelect.selectOption('dark')
    await window.waitForTimeout(500)

    // Create first copy
    await window.click('button:has-text("Copy Theme")')
    await window.waitForSelector('.name-modal', { state: 'visible', timeout: 3000 })

    let nameInput = await window.waitForSelector('.name-modal input[type="text"]', { timeout: 3000 })
    await nameInput.click({ clickCount: 3 })
    await window.keyboard.type(copyName1)
    await window.click('.name-modal button:has-text("Create")')
    await window.waitForSelector('.name-modal-overlay', { state: 'hidden', timeout: 5000 })
    await window.waitForTimeout(500)

    // We should now be on copyName1. Edit it via Monaco API + trigger onChange.
    await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors && editors.length > 0) {
        const editor = editors[editors.length - 1]
        const model = editor.getModel()
        if (model) {
          const content = model.getValue()
          model.setValue(content.replace('--text-color: #d4d4d4', '--text-color: #111111'))
        }
      }
    })
    const editorArea = await window.waitForSelector('.theme-editor-container .monaco-editor .view-lines', { timeout: 5000 })
    await editorArea.click()
    await window.waitForTimeout(300)
    await window.keyboard.press('End')
    await window.keyboard.type(' ')
    await window.waitForTimeout(3000) // Wait for debounced save

    // Go back to dark and make a second copy
    await themeSelect.selectOption('dark')
    await window.waitForTimeout(500)

    await window.click('button:has-text("Copy Theme")')
    await window.waitForSelector('.name-modal', { state: 'visible', timeout: 3000 })

    nameInput = await window.waitForSelector('.name-modal input[type="text"]', { timeout: 3000 })
    await nameInput.click({ clickCount: 3 })
    await window.keyboard.type(copyName2)
    await window.click('.name-modal button:has-text("Create")')
    await window.waitForSelector('.name-modal-overlay', { state: 'hidden', timeout: 5000 })
    await window.waitForTimeout(500)

    // We should now be on copyName2. Verify it does NOT have the first copy's edit.
    const secondCopyCSS = await window.evaluate(() => {
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (editors && editors.length > 0) {
        return editors[editors.length - 1].getValue()
      }
      return ''
    })

    expect(secondCopyCSS).not.toContain('#111111')

    // Switch to first copy and verify its edit is intact
    await themeSelect.selectOption(copyName1)
    await window.waitForTimeout(1500)

    const firstCopyCSS = await window.evaluate(() => {
      const container = document.querySelector('.theme-editor-container')
      const editors = (window as any).monaco?.editor?.getEditors?.()
      if (container && editors) {
        for (const editor of editors) {
          if (container.contains(editor.getDomNode())) {
            return editor.getValue()
          }
        }
      }
      if (editors && editors.length > 0) {
        return editors[editors.length - 1].getValue()
      }
      return ''
    })

    expect(firstCopyCSS).toContain('#111111')

    // Close preferences
    await window.keyboard.press('Escape')
  })
})
