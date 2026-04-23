// Traces: FIO-005 (canonical spec: specs/file-io/spec.md)
import { test, expect } from '../../fixtures'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

let tmpDir: string

test.describe('FIO-005: Save-As With Dialog And Default Filename', () => {
  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wrangle-fio005-'))
  })

  test.afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  test('default filename is "untitled.md" when no suggestedName is provided', async ({
    window,
    electronApp
  }) => {
    const captured = await electronApp.evaluate(async ({ dialog }) => {
      let opts: Electron.SaveDialogOptions | null = null
      const original = dialog.showSaveDialog
      ;(dialog as unknown as { showSaveDialog: typeof dialog.showSaveDialog }).showSaveDialog =
        (async (options: Electron.SaveDialogOptions) => {
          opts = options
          return { canceled: true, filePath: undefined }
        }) as typeof dialog.showSaveDialog
      ;(globalThis as unknown as { __fio005GetOpts: () => unknown }).__fio005GetOpts = () => opts
      ;(globalThis as unknown as { __fio005Restore: () => void }).__fio005Restore = () => {
        ;(dialog as unknown as { showSaveDialog: typeof dialog.showSaveDialog }).showSaveDialog =
          original
      }
      return true
    })
    expect(captured).toBe(true)

    await window.evaluate(() => window.electron.file.saveAs('some content'))

    const opts = (await electronApp.evaluate(async () => {
      const getter = (globalThis as unknown as {
        __fio005GetOpts: () => Electron.SaveDialogOptions | null
      }).__fio005GetOpts
      const result = getter ? getter() : null
      ;(
        globalThis as unknown as { __fio005Restore: () => void }
      ).__fio005Restore()
      return result
    })) as Electron.SaveDialogOptions | null

    expect(opts).not.toBeNull()
    expect(opts!.defaultPath).toBe('untitled.md')
    expect(opts!.filters).toEqual([
      { name: 'Markdown Files', extensions: ['md'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ])
  })

  test('default filename becomes "<suggestedName>.md" when suggestedName is provided', async ({
    window,
    electronApp
  }) => {
    await electronApp.evaluate(async ({ dialog }) => {
      const original = dialog.showSaveDialog
      let opts: Electron.SaveDialogOptions | null = null
      ;(dialog as unknown as { showSaveDialog: typeof dialog.showSaveDialog }).showSaveDialog =
        (async (options: Electron.SaveDialogOptions) => {
          opts = options
          return { canceled: true, filePath: undefined }
        }) as typeof dialog.showSaveDialog
      ;(globalThis as unknown as { __fio005bGetOpts: () => unknown }).__fio005bGetOpts = () => opts
      ;(globalThis as unknown as { __fio005bRestore: () => void }).__fio005bRestore = () => {
        ;(dialog as unknown as { showSaveDialog: typeof dialog.showSaveDialog }).showSaveDialog =
          original
      }
    })

    await window.evaluate(() => window.electron.file.saveAs('content', 'notes'))

    const opts = (await electronApp.evaluate(async () => {
      const getter = (globalThis as unknown as {
        __fio005bGetOpts: () => Electron.SaveDialogOptions | null
      }).__fio005bGetOpts
      const result = getter ? getter() : null
      ;(
        globalThis as unknown as { __fio005bRestore: () => void }
      ).__fio005bRestore()
      return result
    })) as Electron.SaveDialogOptions | null

    expect(opts).not.toBeNull()
    expect(opts!.defaultPath).toBe('notes.md')
  })

  test('confirming the dialog returns the chosen path and writes the file', async ({
    window,
    electronApp
  }) => {
    const chosen = path.join(tmpDir, 'confirmed.md')
    const content = 'Written via Save As\n'

    await electronApp.evaluate(
      async ({ dialog }, filePath) => {
        const original = dialog.showSaveDialog
        ;(dialog as unknown as { showSaveDialog: typeof dialog.showSaveDialog }).showSaveDialog =
          (async () => ({ canceled: false, filePath })) as typeof dialog.showSaveDialog
        ;(globalThis as unknown as { __fio005cRestore: () => void }).__fio005cRestore = () => {
          ;(dialog as unknown as { showSaveDialog: typeof dialog.showSaveDialog }).showSaveDialog =
            original
        }
      },
      chosen
    )

    const returned = await window.evaluate(
      (c) => window.electron.file.saveAs(c),
      content
    )

    await electronApp.evaluate(async () => {
      ;(globalThis as unknown as { __fio005cRestore: () => void }).__fio005cRestore()
    })

    expect(returned).toBe(chosen)
    const onDisk = await fs.readFile(chosen, 'utf-8')
    expect(onDisk).toBe(content)
  })

  test('canceling the dialog returns null and writes nothing', async ({
    window,
    electronApp
  }) => {
    const wouldHaveBeen = path.join(tmpDir, 'never-written.md')

    await electronApp.evaluate(async ({ dialog }) => {
      const original = dialog.showSaveDialog
      ;(dialog as unknown as { showSaveDialog: typeof dialog.showSaveDialog }).showSaveDialog =
        (async () => ({ canceled: true, filePath: undefined })) as typeof dialog.showSaveDialog
      ;(globalThis as unknown as { __fio005dRestore: () => void }).__fio005dRestore = () => {
        ;(dialog as unknown as { showSaveDialog: typeof dialog.showSaveDialog }).showSaveDialog =
          original
      }
    })

    const returned = await window.evaluate(() => window.electron.file.saveAs('anything'))

    await electronApp.evaluate(async () => {
      ;(globalThis as unknown as { __fio005dRestore: () => void }).__fio005dRestore()
    })

    expect(returned).toBeNull()
    // The file at the path we weren't given should definitely not exist.
    await expect(fs.access(wouldHaveBeen)).rejects.toThrow()
  })
})
