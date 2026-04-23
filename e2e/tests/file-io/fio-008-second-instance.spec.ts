// Traces: FIO-008 (canonical spec: specs/file-io/spec.md)
import { test, expect } from '../../fixtures'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

let tmpDir: string

test.describe('FIO-008: Second-Instance File Forwarding', () => {
  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wrangle-fio008-'))
  })

  test.afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  test('second-instance event with a valid file path forwards file:openFromPath and focuses window', async ({
    electronApp,
    window
  }) => {
    const filePath = path.join(tmpDir, 'other.md')
    const content = '# Opened in second-instance handler\n'
    await fs.writeFile(filePath, content, 'utf-8')

    // Set up renderer listener BEFORE emitting the event.
    const receivedPromise = window.evaluate(() => {
      return new Promise<{ path: string; content: string } | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 10000)
        window.electron.onFileOpenedFromPath((data) => {
          clearTimeout(timeout)
          resolve(data)
        })
      })
    })

    // Simulate a second-instance event on the primary.
    // Emulate argv format: [electronExe, appPath, <filePath>]
    const focusCalled = await electronApp.evaluate(
      async ({ app, BrowserWindow }, simulatedArg) => {
        const wins = BrowserWindow.getAllWindows()
        const primary = wins[0]
        let focused = false
        const originalFocus = primary.focus.bind(primary)
        primary.focus = () => {
          focused = true
          originalFocus()
        }
        app.emit('second-instance', {} as Electron.Event, [
          'electron.exe',
          'app-main.js',
          simulatedArg
        ])
        // Give the async handler a chance to read the file and send IPC.
        await new Promise((r) => setTimeout(r, 1500))
        return focused
      },
      filePath
    )

    expect(focusCalled).toBe(true)

    const received = await receivedPromise
    expect(received).not.toBeNull()
    expect(received!.path).toBe(filePath)
    expect(received!.content).toBe(content)
  })

  test('second-instance with a minimized primary restores and brings it to front', async ({
    electronApp,
    window
  }) => {
    const filePath = path.join(tmpDir, 'restore.md')
    const content = '# Restore test\n'
    await fs.writeFile(filePath, content, 'utf-8')

    const receivedPromise = window.evaluate(() => {
      return new Promise<{ path: string; content: string } | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 10000)
        window.electron.onFileOpenedFromPath((data) => {
          clearTimeout(timeout)
          resolve(data)
        })
      })
    })

    const outcome = await electronApp.evaluate(
      async ({ app, BrowserWindow }, simulatedArg) => {
        const primary = BrowserWindow.getAllWindows()[0]
        // Force state: minimized
        primary.minimize()

        let restored = false
        let focused = false
        const origRestore = primary.restore.bind(primary)
        const origFocus = primary.focus.bind(primary)
        primary.restore = () => {
          restored = true
          origRestore()
        }
        primary.focus = () => {
          focused = true
          origFocus()
        }

        app.emit('second-instance', {} as Electron.Event, [
          'electron.exe',
          'app-main.js',
          simulatedArg
        ])
        await new Promise((r) => setTimeout(r, 1500))
        return { restored, focused, visible: primary.isVisible() }
      },
      filePath
    )

    expect(outcome.restored).toBe(true)
    expect(outcome.focused).toBe(true)

    const received = await receivedPromise
    expect(received).not.toBeNull()
    expect(received!.path).toBe(filePath)
  })

  test('second-instance with no file argument focuses window but opens no tab', async ({
    electronApp,
    window
  }) => {
    // Register a listener that resolves only if an event fires within the timeout.
    const receivedPromise = window.evaluate(() => {
      return new Promise<{ path: string; content: string } | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 2000)
        window.electron.onFileOpenedFromPath((data) => {
          clearTimeout(timeout)
          resolve(data)
        })
      })
    })

    const focused = await electronApp.evaluate(async ({ app, BrowserWindow }) => {
      const primary = BrowserWindow.getAllWindows()[0]
      let focusCalled = false
      const origFocus = primary.focus.bind(primary)
      primary.focus = () => {
        focusCalled = true
        origFocus()
      }
      app.emit('second-instance', {} as Electron.Event, [
        'electron.exe',
        'app-main.js',
        '--no-file'
      ])
      await new Promise((r) => setTimeout(r, 500))
      return focusCalled
    })

    expect(focused).toBe(true)

    const received = await receivedPromise
    expect(received).toBeNull()
  })

  test('second-instance with a .png (non-text) path focuses window but opens no tab', async ({
    electronApp,
    window
  }) => {
    const pngPath = path.join(tmpDir, 'pic.png')
    await fs.writeFile(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    const receivedPromise = window.evaluate(() => {
      return new Promise<{ path: string; content: string } | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 2000)
        window.electron.onFileOpenedFromPath((data) => {
          clearTimeout(timeout)
          resolve(data)
        })
      })
    })

    const focused = await electronApp.evaluate(
      async ({ app, BrowserWindow }, arg) => {
        const primary = BrowserWindow.getAllWindows()[0]
        let focusCalled = false
        const origFocus = primary.focus.bind(primary)
        primary.focus = () => {
          focusCalled = true
          origFocus()
        }
        app.emit('second-instance', {} as Electron.Event, [
          'electron.exe',
          'app-main.js',
          arg
        ])
        await new Promise((r) => setTimeout(r, 500))
        return focusCalled
      },
      pngPath
    )

    expect(focused).toBe(true)

    const received = await receivedPromise
    expect(received).toBeNull()
  })
})
