// Traces: FIO-007 (canonical spec: specs/file-io/spec.md)
import { test, expect } from '../../fixtures'
import { _electron as electron, ElectronApplication } from '@playwright/test'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

const appPath = path.resolve(__dirname, '../../../out/main/index.js')
const electronExe = process.platform === 'win32' ? 'electron.exe' : 'electron'
const electronPath = path.resolve(
  __dirname,
  `../../../node_modules/electron/dist/${electronExe}`
)

async function launchWithArgs(extraArgs: string[]): Promise<ElectronApplication> {
  const cleanEnv = { ...process.env }
  delete cleanEnv.ELECTRON_RUN_AS_NODE
  return electron.launch({
    executablePath: electronPath,
    args: [appPath, ...extraArgs],
    env: { ...cleanEnv, NODE_ENV: 'test' }
  })
}

let tmpDir: string

test.describe('FIO-007: CLI File Argument Opens On First Launch', () => {
  test.beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wrangle-fio007-'))
  })

  test.afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  // Use the default fixture for these tests? No — we need fresh launches with args,
  // and the default fixture has already launched one instance. Skip it.
  test.use({
    electronApp: async ({}, use) => {
      // Provide a no-op app so the fixture doesn't launch a default instance.
      await use(null as unknown as ElectronApplication)
    },
    window: async ({}, use) => {
      await use(null as unknown as never)
    }
  })

  test('launching with a valid .md path sends file:openFromPath to the renderer', async () => {
    const filePath = path.join(tmpDir, 'cli.md')
    const content = '# Opened via CLI\n'
    await fs.writeFile(filePath, content, 'utf-8')

    const app = await launchWithArgs([filePath])
    try {
      const win = await app.firstWindow()
      await win.waitForLoadState('domcontentloaded')

      // Register an IPC listener in the renderer to capture the event.
      const received = await win.evaluate(() => {
        return new Promise<{ path: string; content: string } | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 10000)
          window.electron.onFileOpenedFromPath((data) => {
            clearTimeout(timeout)
            resolve(data)
          })
        })
      })

      expect(received).not.toBeNull()
      expect(received!.path).toBe(filePath)
      expect(received!.content).toBe(content)
    } finally {
      await app.close()
    }
  })

  test('launching with only a flag argument does NOT auto-open any file', async () => {
    const app = await launchWithArgs(['--some-flag'])
    try {
      const win = await app.firstWindow()
      await win.waitForLoadState('domcontentloaded')

      const received = await win.evaluate(() => {
        return new Promise<{ path: string; content: string } | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 2000)
          window.electron.onFileOpenedFromPath((data) => {
            clearTimeout(timeout)
            resolve(data)
          })
        })
      })

      expect(received).toBeNull()
    } finally {
      await app.close()
    }
  })

  test('launching with a non-existent .md path does NOT open anything', async () => {
    const missing = path.join(tmpDir, 'definitely-not-here.md')

    const app = await launchWithArgs([missing])
    try {
      const win = await app.firstWindow()
      await win.waitForLoadState('domcontentloaded')

      const received = await win.evaluate(() => {
        return new Promise<{ path: string; content: string } | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 2000)
          window.electron.onFileOpenedFromPath((data) => {
            clearTimeout(timeout)
            resolve(data)
          })
        })
      })

      expect(received).toBeNull()
    } finally {
      await app.close()
    }
  })

  test('launching with a .png path does NOT auto-open (non-text extension)', async () => {
    const pngPath = path.join(tmpDir, 'pic.png')
    await fs.writeFile(pngPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]))

    const app = await launchWithArgs([pngPath])
    try {
      const win = await app.firstWindow()
      await win.waitForLoadState('domcontentloaded')

      const received = await win.evaluate(() => {
        return new Promise<{ path: string; content: string } | null>((resolve) => {
          const timeout = setTimeout(() => resolve(null), 2000)
          window.electron.onFileOpenedFromPath((data) => {
            clearTimeout(timeout)
            resolve(data)
          })
        })
      })

      expect(received).toBeNull()
    } finally {
      await app.close()
    }
  })
})
