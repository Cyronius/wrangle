// Traces: FIO-009 (canonical spec: specs/file-io/spec.md)
import { test, expect } from '../../fixtures'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

let tmpDir: string

test.describe('FIO-009: Unreadable Files Skipped With Logged Error', () => {
  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wrangle-fio009-'))
  })

  test.afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  test('three selected files, one deleted mid-flight → two tabs open, one error logged, no dialog', async ({
    electronApp
  }) => {
    const a = path.join(tmpDir, 'a.md')
    const b = path.join(tmpDir, 'b.md')
    const gone = path.join(tmpDir, 'gone.md')
    await fs.writeFile(a, '# A\n', 'utf-8')
    await fs.writeFile(b, '# B\n', 'utf-8')

    const result = await electronApp.evaluate(
      async ({ dialog, BrowserWindow }, selected) => {
        // Capture console.error calls
        const calls: string[] = []
        const origError = console.error
        console.error = ((...args: unknown[]) => {
          calls.push(args.map((a) => String(a)).join(' '))
        }) as typeof console.error

        // Track error-dialog attempts (there should be none)
        let errBoxCount = 0
        const originalErrBox = dialog.showErrorBox
        ;(dialog as unknown as { showErrorBox: typeof dialog.showErrorBox }).showErrorBox = ((
          _t: string,
          _c: string
        ) => {
          errBoxCount += 1
        }) as typeof dialog.showErrorBox

        // Stub open dialog to return three paths, one of which won't exist on disk.
        const originalOpen = dialog.showOpenDialog
        ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
          (async () => ({
            canceled: false,
            filePaths: selected
          })) as typeof dialog.showOpenDialog

        try {
          const win = BrowserWindow.getAllWindows()[0]
          const files = (await win.webContents.executeJavaScript(
            'window.electron.file.open()'
          )) as Array<{ path: string; content: string }>
          return { files, errBoxCount, logs: calls }
        } finally {
          console.error = origError
          ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
            originalOpen
          ;(dialog as unknown as { showErrorBox: typeof dialog.showErrorBox }).showErrorBox =
            originalErrBox
        }
      },
      [a, gone, b]
    )

    expect(result.files).toHaveLength(2)
    expect(result.files.map((f) => f.path).sort()).toEqual([a, b].sort())
    expect(result.errBoxCount).toBe(0)
    // At least one log entry referencing the missing file
    expect(result.logs.some((l) => l.includes('Error reading file') && l.includes(gone))).toBe(
      true
    )
  })

  test('three selected, one unreadable (directory used where file expected) → two tabs, one logged error', async ({
    electronApp
  }) => {
    const a = path.join(tmpDir, 'ok1.md')
    const b = path.join(tmpDir, 'ok2.md')
    const badDir = path.join(tmpDir, 'is-a-directory')
    await fs.writeFile(a, '# OK1\n', 'utf-8')
    await fs.writeFile(b, '# OK2\n', 'utf-8')
    await fs.mkdir(badDir, { recursive: true })

    const result = await electronApp.evaluate(
      async ({ dialog, BrowserWindow }, selected) => {
        const calls: string[] = []
        const origError = console.error
        console.error = ((...args: unknown[]) => {
          calls.push(args.map((a) => String(a)).join(' '))
        }) as typeof console.error

        const originalOpen = dialog.showOpenDialog
        ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
          (async () => ({
            canceled: false,
            filePaths: selected
          })) as typeof dialog.showOpenDialog

        try {
          const win = BrowserWindow.getAllWindows()[0]
          const files = (await win.webContents.executeJavaScript(
            'window.electron.file.open()'
          )) as Array<{ path: string; content: string }>
          return { files, logs: calls }
        } finally {
          console.error = origError
          ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
            originalOpen
        }
      },
      [a, badDir, b]
    )

    expect(result.files).toHaveLength(2)
    expect(result.files.map((f) => f.path).sort()).toEqual([a, b].sort())
    expect(result.logs.some((l) => l.includes('Error reading file') && l.includes(badDir))).toBe(
      true
    )
  })

  test('single unreadable file returns empty array and logs the error', async ({
    electronApp
  }) => {
    const missing = path.join(tmpDir, 'not-there.md')

    const result = await electronApp.evaluate(
      async ({ dialog, BrowserWindow }, selected) => {
        const calls: string[] = []
        const origError = console.error
        console.error = ((...args: unknown[]) => {
          calls.push(args.map((a) => String(a)).join(' '))
        }) as typeof console.error

        const originalOpen = dialog.showOpenDialog
        ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
          (async () => ({
            canceled: false,
            filePaths: selected
          })) as typeof dialog.showOpenDialog

        try {
          const win = BrowserWindow.getAllWindows()[0]
          const files = (await win.webContents.executeJavaScript(
            'window.electron.file.open()'
          )) as Array<{ path: string; content: string }>
          return { files, logs: calls }
        } finally {
          console.error = origError
          ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
            originalOpen
        }
      },
      [missing]
    )

    expect(result.files).toEqual([])
    expect(result.logs.some((l) => l.includes('Error reading file') && l.includes(missing))).toBe(
      true
    )
  })
})
