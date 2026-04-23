// Traces: FIO-006 (canonical spec: specs/file-io/spec.md)
import { test, expect } from '../../fixtures'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

let tmpDir: string

test.describe('FIO-006: Auto-Save To Draft Or Known Path', () => {
  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wrangle-fio006-'))
  })

  test.afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  test('auto-saving a tab with a known path writes to that path and returns it', async ({
    window
  }) => {
    const filePath = path.join(tmpDir, 'auto-save-known.md')
    const content = '# Auto-saved content\n'
    const tabId = 'fio006-tab-known'

    const returned = await window.evaluate(
      ({ tab, c, p }) => window.electron.file.autoSave(tab, c, p),
      { tab: tabId, c: content, p: filePath }
    )

    expect(returned).toBe(filePath)
    const onDisk = await fs.readFile(filePath, 'utf-8')
    expect(onDisk).toBe(content)
  })

  test('auto-saving an untitled tab (null path) writes to a temp draft path scoped by tabId', async ({
    window
  }) => {
    const tabId = 'fio006-tab-' + Date.now()
    const content = '# Draft content\n'

    const returned = await window.evaluate(
      ({ tab, c }) => window.electron.file.autoSave(tab, c, null),
      { tab: tabId, c: content }
    )

    expect(returned).not.toBeNull()
    expect(typeof returned).toBe('string')
    // Draft path should be under the user's home .wrangle/drafts/<tabId>/draft.md
    const expectedSuffix = path.join('.wrangle', 'drafts', tabId, 'draft.md')
    expect((returned as string).endsWith(expectedSuffix)).toBe(true)

    const onDisk = await fs.readFile(returned as string, 'utf-8')
    expect(onDisk).toBe(content)

    // Cleanup the draft directory we just created
    await fs.rm(path.dirname(returned as string), { recursive: true, force: true }).catch(() => {})
  })

  test('auto-save failure (invalid parent directory) returns null with no dialog', async ({
    window,
    electronApp
  }) => {
    // Track any error dialog calls (auto-save should NOT show one).
    await electronApp.evaluate(async ({ dialog }) => {
      ;(globalThis as unknown as { __fio006ErrCalls: number }).__fio006ErrCalls = 0
      ;(dialog as unknown as { showErrorBox: typeof dialog.showErrorBox }).showErrorBox = ((
        _title: string,
        _content: string
      ) => {
        ;(globalThis as unknown as { __fio006ErrCalls: number }).__fio006ErrCalls += 1
      }) as typeof dialog.showErrorBox
    })

    const bogus = path.join(tmpDir, 'missing-subdir', 'draft.md')

    const returned = await window.evaluate(
      ({ tab, c, p }) => window.electron.file.autoSave(tab, c, p),
      { tab: 'fio006-bogus', c: 'x', p: bogus }
    )

    expect(returned).toBeNull()

    const errCalls = await electronApp.evaluate(async () => {
      return (globalThis as unknown as { __fio006ErrCalls: number }).__fio006ErrCalls
    })
    expect(errCalls).toBe(0)
  })
})
