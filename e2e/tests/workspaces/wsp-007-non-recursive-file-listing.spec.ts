// Traces: WSP-007 (canonical spec: specs/workspaces/spec.md)
import { test, expect } from '../../fixtures'
import path from 'path'
import { launchWithCleanProfile } from '../../helpers/settings-helpers'
import {
  createTempWorkspaceFolder,
  removeTempFolder,
  seedWorkspaceTree
} from '../../helpers/workspace-fs-helpers'

interface Node {
  name: string
  path: string
  isDirectory: boolean
  children?: Node[]
}

test.describe('WSP-007: Non-Recursive File Listing (Depth 1)', () => {
  test('returns a single-level listing without children fields', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        'a.md': '# a',
        'b.md': '# b',
        'sub/': null,
        'sub/nested.md': '# nested'
      })

      const nodes = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFiles(p),
        folder
      )
      const names = nodes.map((n) => n.name).sort()
      expect(names).toEqual(['a.md', 'b.md', 'sub'])
      for (const n of nodes) {
        expect(n).toHaveProperty('name')
        expect(n).toHaveProperty('path')
        expect(n).toHaveProperty('isDirectory')
        expect(n.children).toBeUndefined()
      }

      const sub = nodes.find((n) => n.name === 'sub')!
      expect(sub.isDirectory).toBe(true)
      expect(sub.path).toBe(path.join(folder, 'sub'))
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('.wrangle directory is always skipped', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        'visible.md': '# hi',
        '.wrangle/workspace.json': '{}',
        '.wrangle/session.json': '{}'
      })
      const nodesHidden = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFiles(p, true),
        folder
      )
      expect(nodesHidden.find((n) => n.name === '.wrangle')).toBeUndefined()
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('dotfiles skipped by default', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        'normal.md': 'x',
        '.env': 'SECRET=1',
        '.hidden/': null,
        '.hidden/inside.md': 'y'
      })
      const nodes = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFiles(p),
        folder
      )
      const names = nodes.map((n) => n.name)
      expect(names).toContain('normal.md')
      expect(names).not.toContain('.env')
      expect(names).not.toContain('.hidden')
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('results are sorted: directories before files, then alphabetical', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        'zebra.md': 'z',
        'apple.md': 'a',
        'zulu/': null,
        'alpha/': null
      })
      const nodes = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFiles(p),
        folder
      )
      const names = nodes.map((n) => n.name)
      expect(names).toEqual(['alpha', 'zulu', 'apple.md', 'zebra.md'])
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('top-level error (non-existent path) resolves to empty array', async () => {
    const app = await launchWithCleanProfile()
    try {
      const nodes = await app.window.evaluate(async () =>
        window.electron.workspace.listFiles('C:/does-not-exist-e2e-wsp/__missing__')
      )
      expect(nodes).toEqual([])
    } finally {
      await app.cleanup()
    }
  })
})
