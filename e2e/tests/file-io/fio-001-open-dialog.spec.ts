// Traces: FIO-001 (canonical spec: specs/file-io/spec.md)
import { test, expect } from '../../fixtures'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

let tmpDir: string
const createdFiles: string[] = []

test.describe('FIO-001: Open File Dialog With Filters And Multi-Select', () => {
  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wrangle-fio001-'))
  })

  test.afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  test('dialog is configured with multiSelections and markdown/text/all filters', async ({
    electronApp
  }) => {
    // Install stub, invoke preload API, capture options, then restore.
    const opts = await electronApp.evaluate(async ({ dialog, BrowserWindow }) => {
      const original = dialog.showOpenDialog
      let captured: Electron.OpenDialogOptions | null = null
      ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
        (async (options: Electron.OpenDialogOptions) => {
          captured = options
          return { canceled: true, filePaths: [] }
        }) as typeof dialog.showOpenDialog

      const win = BrowserWindow.getAllWindows()[0]
      await win.webContents.executeJavaScript('window.electron.file.open()')

      ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
        original
      return captured
    })

    expect(opts).not.toBeNull()
    expect(opts!.properties).toEqual(expect.arrayContaining(['openFile', 'multiSelections']))
    expect(opts!.filters).toEqual([
      { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdwn'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ])
  })

  test('selecting a single .md file returns one FileData with UTF-8 content', async ({
    electronApp
  }) => {
    const filePath = path.join(tmpDir, 'single.md')
    const content = '# Hello\n\nUnicode: café naïve 日本語\n'
    await fs.writeFile(filePath, content, 'utf-8')
    createdFiles.push(filePath)

    const result = await electronApp.evaluate(
      async ({ dialog, BrowserWindow }, paths) => {
        const original = dialog.showOpenDialog
        ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
          (async () => ({ canceled: false, filePaths: paths })) as typeof dialog.showOpenDialog
        try {
          const win = BrowserWindow.getAllWindows()[0]
          return await win.webContents.executeJavaScript('window.electron.file.open()')
        } finally {
          ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
            original
        }
      },
      [filePath]
    )

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
    expect(result[0].path).toBe(filePath)
    expect(result[0].content).toBe(content)
  })

  test('selecting three files returns three FileData records', async ({ electronApp }) => {
    const files = [
      { name: 'a.md', content: '# A\n' },
      { name: 'b.md', content: '# B\n' },
      { name: 'c.md', content: '# C\n' }
    ]
    const paths: string[] = []
    for (const f of files) {
      const p = path.join(tmpDir, f.name)
      await fs.writeFile(p, f.content, 'utf-8')
      paths.push(p)
      createdFiles.push(p)
    }

    const result = await electronApp.evaluate(
      async ({ dialog, BrowserWindow }, selected) => {
        const original = dialog.showOpenDialog
        ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
          (async () => ({ canceled: false, filePaths: selected })) as typeof dialog.showOpenDialog
        try {
          const win = BrowserWindow.getAllWindows()[0]
          return await win.webContents.executeJavaScript('window.electron.file.open()')
        } finally {
          ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
            original
        }
      },
      paths
    )

    expect(result).toHaveLength(3)
    expect(result.map((r: { path: string }) => r.path)).toEqual(paths)
    expect(result.map((r: { content: string }) => r.content)).toEqual(files.map((f) => f.content))
  })

  test('canceling the dialog returns an empty array', async ({ electronApp }) => {
    const result = await electronApp.evaluate(async ({ dialog, BrowserWindow }) => {
      const original = dialog.showOpenDialog
      ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
        (async () => ({ canceled: true, filePaths: [] })) as typeof dialog.showOpenDialog
      try {
        const win = BrowserWindow.getAllWindows()[0]
        return await win.webContents.executeJavaScript('window.electron.file.open()')
      } finally {
        ;(dialog as unknown as { showOpenDialog: typeof dialog.showOpenDialog }).showOpenDialog =
          original
      }
    })

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(0)
  })
})
