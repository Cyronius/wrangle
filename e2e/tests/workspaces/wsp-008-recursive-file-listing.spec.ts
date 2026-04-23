// Traces: WSP-008 (canonical spec: specs/workspaces/spec.md)
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

function findChild(nodes: Node[], name: string): Node | undefined {
  return nodes.find((n) => n.name === name)
}

test.describe('WSP-008: Recursive File Listing (maxDepth 5)', () => {
  test('returns nested tree with children on directory nodes', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        'top.md': '#',
        'dir1/inside.md': '#',
        'dir1/dir2/deep.md': '#'
      })
      const nodes = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFilesRecursive(p),
        folder
      )
      const dir1 = findChild(nodes, 'dir1')!
      expect(dir1.isDirectory).toBe(true)
      expect(Array.isArray(dir1.children)).toBe(true)
      const dir2 = findChild(dir1.children!, 'dir2')!
      expect(dir2.isDirectory).toBe(true)
      expect(findChild(dir2.children!, 'deep.md')).toBeTruthy()
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('recursion stops at maxDepth (depth=1 yields no grandchildren)', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        'a/b/c.md': '#'
      })
      const nodes = await app.window.evaluate<Node[], { p: string; d: number }>(
        async ({ p, d }) => window.electron.workspace.listFilesRecursive(p, d),
        { p: folder, d: 1 }
      )
      const a = findChild(nodes, 'a')!
      expect(a.isDirectory).toBe(true)
      // Depth 1 listed only the top entries; `a`'s children array must be empty.
      expect(a.children).toEqual([])
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('default IPC maxDepth of 5 is deep enough to reach 4 levels of nesting', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        'l1/l2/l3/l4/leaf.md': '#'
      })
      const nodes = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFilesRecursive(p),
        folder
      )
      const leaf = findChild(
        findChild(
          findChild(findChild(nodes, 'l1')!.children!, 'l2')!.children!,
          'l3'
        )!.children!,
        'l4'
      )
      expect(leaf).toBeTruthy()
      expect(findChild(leaf!.children!, 'leaf.md')).toBeTruthy()
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('.wrangle is skipped at every level', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        '.wrangle/workspace.json': '{}',
        'sub/.wrangle/workspace.json': '{}',
        'sub/keep.md': '#'
      })
      const nodes = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFilesRecursive(p, 5, true),
        folder
      )
      expect(findChild(nodes, '.wrangle')).toBeUndefined()
      const sub = findChild(nodes, 'sub')!
      expect(sub.children!.map((c) => c.name)).toContain('keep.md')
      expect(findChild(sub.children!, '.wrangle')).toBeUndefined()
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('each level is sorted: directories before files, alphabetical', async () => {
    const app = await launchWithCleanProfile()
    const folder = await createTempWorkspaceFolder()
    try {
      await seedWorkspaceTree(folder, {
        'zoo.md': '#',
        'abc.md': '#',
        'zeta/': null,
        'alpha/': null,
        'zeta/yy.md': '#',
        'zeta/aa.md': '#',
        'zeta/beta/': null
      })
      const nodes = await app.window.evaluate<Node[], string>(
        async (p) => window.electron.workspace.listFilesRecursive(p),
        folder
      )
      expect(nodes.map((n) => n.name)).toEqual(['alpha', 'zeta', 'abc.md', 'zoo.md'])
      const zeta = findChild(nodes, 'zeta')!
      expect(zeta.children!.map((c) => c.name)).toEqual(['beta', 'aa.md', 'yy.md'])
    } finally {
      await removeTempFolder(folder)
      await app.cleanup()
    }
  })

  test('top-level error resolves to empty array', async () => {
    const app = await launchWithCleanProfile()
    try {
      const nodes = await app.window.evaluate(async () =>
        window.electron.workspace.listFilesRecursive('C:/does-not-exist-e2e-wsp/__missing__')
      )
      expect(nodes).toEqual([])
    } finally {
      await app.cleanup()
    }
  })
})
