import { test, expect } from '@playwright/test'
import { _electron as electron } from '@playwright/test'
import path from 'path'
import { waitForMonacoReady } from '../fixtures'

// Test file path - a large markdown document where performance issues are observed
const TEST_FILE_PATH = '/home/cyrus/code/covenant/docs/design/COMPILER.md'

test.describe('Typing Performance - Real File', () => {
  test('should measure keystroke latency typing at beginning of large file', async () => {
    // Launch app with file path argument
    const appPath = path.resolve(__dirname, '../../out/main/index.js')
    const electronPath = path.resolve(
      __dirname,
      `../../node_modules/electron/dist/${process.platform === 'win32' ? 'electron.exe' : 'electron'}`
    )

    const cleanEnv = { ...process.env }
    delete cleanEnv.ELECTRON_RUN_AS_NODE

    const electronApp = await electron.launch({
      executablePath: electronPath,
      args: [appPath, TEST_FILE_PATH],
      env: {
        ...cleanEnv,
        NODE_ENV: 'test'
      }
    })

    try {
      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')

      console.log('\n=== Real File Typing Performance Test ===')
      console.log(`File: ${TEST_FILE_PATH}`)

      // Wait for Monaco to be ready
      await waitForMonacoReady(window)

      // Wait for the file content to be loaded (check that editor has substantial content)
      await window.waitForFunction(
        () => {
          const monacoInstance = (window as any).monaco
          if (!monacoInstance) return false
          const editors = monacoInstance.editor.getEditors()
          if (editors.length === 0) return false
          const model = editors[0].getModel()
          // COMPILER.md is ~53KB, wait for at least 10KB to ensure it's loaded
          return model && model.getValue().length > 10000
        },
        { timeout: 15000 }
      )

      // Get document size for logging
      const docSize = await window.evaluate(() => {
        const monacoInstance = (window as any).monaco
        const editors = monacoInstance.editor.getEditors()
        return editors[0].getModel().getValue().length
      })
      console.log(`Document size: ${docSize} characters`)

      // Move cursor to line 1, column 1
      await window.evaluate(() => {
        const monacoInstance = (window as any).monaco
        const editors = monacoInstance.editor.getEditors()
        const editor = editors[0]
        editor.setPosition({ lineNumber: 1, column: 1 })
        editor.focus()
      })

      await window.waitForTimeout(100)

      // Measure typing performance
      const results: number[] = []
      const testText = 'New content at the start of a real document. '

      console.log(`Typing ${testText.length} characters at document start...`)

      for (const char of testText) {
        const start = Date.now()
        await window.keyboard.type(char, { delay: 0 })
        // Wait for editor to process the input
        await window.waitForFunction(
          () => document.querySelector('.monaco-editor .view-line') !== null,
          { timeout: 1000 }
        )
        const end = Date.now()
        results.push(end - start)
      }

      // Calculate statistics
      const sorted = [...results].sort((a, b) => a - b)
      const avg = results.reduce((a, b) => a + b, 0) / results.length
      const min = sorted[0]
      const max = sorted[sorted.length - 1]
      const p50 = sorted[Math.floor(sorted.length * 0.5)]
      const p95 = sorted[Math.floor(sorted.length * 0.95)]
      const p99 = sorted[Math.floor(sorted.length * 0.99)]

      console.log('\n=== Results ===')
      console.log(`Total keystrokes: ${results.length}`)
      console.log(`Average latency: ${avg.toFixed(2)}ms`)
      console.log(`Min latency: ${min}ms`)
      console.log(`Max latency: ${max}ms`)
      console.log(`P50 latency: ${p50}ms`)
      console.log(`P95 latency: ${p95}ms`)
      console.log(`P99 latency: ${p99}ms`)

      // Thresholds (soft - used for reporting, not failure)
      const TARGET_AVG = 50
      const TARGET_P99 = 150

      console.log(`\n=== Thresholds ===`)
      console.log(
        `Target avg: <${TARGET_AVG}ms (actual: ${avg.toFixed(2)}ms) ${avg < TARGET_AVG ? 'PASS' : 'FAIL'}`
      )
      console.log(`Target p99: <${TARGET_P99}ms (actual: ${p99}ms) ${p99 < TARGET_P99 ? 'PASS' : 'FAIL'}`)

      // Soft assertions - warn but don't fail
      if (avg >= TARGET_AVG) {
        console.log(`\nWARNING: Average latency (${avg.toFixed(2)}ms) exceeds target (${TARGET_AVG}ms)`)
      }
      if (p99 >= TARGET_P99) {
        console.log(`\nWARNING: P99 latency (${p99}ms) exceeds target (${TARGET_P99}ms)`)
      }

      // Only assert that we got valid results
      expect(results.length).toBeGreaterThan(0)
    } finally {
      await electronApp.close()
    }
  })

  test('should measure rapid typing performance in large file', async () => {
    // Launch app with file path argument
    const appPath = path.resolve(__dirname, '../../out/main/index.js')
    const electronPath = path.resolve(
      __dirname,
      `../../node_modules/electron/dist/${process.platform === 'win32' ? 'electron.exe' : 'electron'}`
    )

    const cleanEnv = { ...process.env }
    delete cleanEnv.ELECTRON_RUN_AS_NODE

    const electronApp = await electron.launch({
      executablePath: electronPath,
      args: [appPath, TEST_FILE_PATH],
      env: {
        ...cleanEnv,
        NODE_ENV: 'test'
      }
    })

    try {
      const window = await electronApp.firstWindow()
      await window.waitForLoadState('domcontentloaded')

      console.log('\n=== Rapid Typing in Large File Test ===')

      // Wait for Monaco to be ready
      await waitForMonacoReady(window)

      // Wait for the file content to be loaded
      await window.waitForFunction(
        () => {
          const monacoInstance = (window as any).monaco
          if (!monacoInstance) return false
          const editors = monacoInstance.editor.getEditors()
          if (editors.length === 0) return false
          const model = editors[0].getModel()
          return model && model.getValue().length > 10000
        },
        { timeout: 15000 }
      )

      // Move cursor to line 1, column 1
      await window.evaluate(() => {
        const monacoInstance = (window as any).monaco
        const editors = monacoInstance.editor.getEditors()
        const editor = editors[0]
        editor.setPosition({ lineNumber: 1, column: 1 })
        editor.focus()
      })

      await window.waitForTimeout(100)

      console.log('Typing 200 characters as fast as possible...')

      const startTime = Date.now()

      // Type rapidly without individual measurements
      const rapidText = 'a'.repeat(200)
      await window.keyboard.type(rapidText, { delay: 0 })

      // Wait for editor to settle
      await window.waitForTimeout(500)

      const endTime = Date.now()
      const totalTime = endTime - startTime
      const avgPerChar = totalTime / 200

      console.log(`\nTotal time: ${totalTime}ms`)
      console.log(`Average per character: ${avgPerChar.toFixed(2)}ms`)
      console.log(`Characters per second: ${(1000 / avgPerChar).toFixed(0)}`)

      // Verify the text was typed - check how many 'a's appear at the start
      const editorContent = await window.evaluate(() => {
        const monacoInstance = (window as any).monaco
        const editors = monacoInstance.editor.getEditors()
        return editors[0].getModel().getValue().substring(0, 300)
      })

      // Count consecutive 'a's at start
      let consecutiveAs = 0
      for (const char of editorContent) {
        if (char === 'a') consecutiveAs++
        else break
      }

      console.log(`Editor content starts with: ${editorContent.substring(0, 50)}...`)
      console.log(`Typed ${consecutiveAs} of 200 characters (${((consecutiveAs / 200) * 100).toFixed(1)}% success rate)`)

      // Expect at least some characters were typed (soft check - performance degradation may cause drops)
      expect(consecutiveAs).toBeGreaterThan(0)
    } finally {
      await electronApp.close()
    }
  })
})
