// Traces: WSP-009 (canonical spec: specs/workspaces/spec.md)
import { test, expect } from '../../fixtures'
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

test.describe('WSP-009: Hidden-File Toggle', () => {
  test('showHidden undefined/false skips dotfile entries', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        'visible.md': 'v',
        '.hidden-file': 'h',
        '.hidden-dir/': null,
        '.hidden-dir/inside.md': '#'
      })
      const nodesDefault = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFiles(p),
        folder
      )
      const nodesFalse = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFiles(p, false),
        folder
      )
      expect(nodesDefault.map((n) => n.name)).toEqual(['visible.md'])
      expect(nodesFalse.map((n) => n.name)).toEqual(['visible.md'])
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('showHidden=true includes dotfiles in listFiles output', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        'visible.md': 'v',
        '.env': 'SECRET=1',
        '.hidden-dir/': null
      })
      const nodes = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFiles(p, true),
        folder
      )
      const names = nodes.map((n) => n.name).sort()
      expect(names).toEqual(['.env', '.hidden-dir', 'visible.md'])
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('.wrangle is ALWAYS skipped regardless of showHidden', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        '.wrangle/workspace.json': '{}',
        '.wrangle/session.json': '{}',
        '.env': 'x',
        'visible.md': 'v'
      })
      const nodes = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFiles(p, true),
        folder
      )
      const names = nodes.map((n) => n.name)
      expect(names).toContain('.env') // included because showHidden=true
      expect(names).toContain('visible.md')
      expect(names).not.toContain('.wrangle') // still hidden
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('toggle applies at every level of listFilesRecursive', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        'sub/': null,
        'sub/.hidden-inside': 'x',
        'sub/visible.md': 'v',
        '.top-hidden': 'x'
      })

      const hidden = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFilesRecursive(p, 5, false),
        folder
      )
      const subH = hidden.find((n) => n.name === 'sub')!
      expect(hidden.map((n) => n.name)).toEqual(['sub'])
      expect(subH.children!.map((c) => c.name)).toEqual(['visible.md'])

      const shown = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFilesRecursive(p, 5, true),
        folder
      )
      const subS = shown.find((n) => n.name === 'sub')!
      expect(shown.map((n) => n.name).sort()).toEqual(['.top-hidden', 'sub'])
      expect(subS.children!.map((c) => c.name).sort()).toEqual(['.hidden-inside', 'visible.md'])
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })
})
