// Traces: CRR-003 (canonical spec: specs/crash-recovery/spec.md)
import { test, expect } from '../../fixtures'

test.describe('CRR-003: Orphan Draft Discovery', () => {
  test('returns per-tab OrphanedDraft entries for populated draft.md files', async ({ electronApp }) => {
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const draftsDir = path.join(os.homedir(), '.wrangle', 'drafts')
      const { findOrphanedDrafts } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      // Prepare two tabs with content
      const tab1 = '__crr003_tab_a__'
      const tab2 = '__crr003_tab_b__'
      fs.mkdirSync(path.join(draftsDir, tab1), { recursive: true })
      fs.mkdirSync(path.join(draftsDir, tab2), { recursive: true })
      fs.writeFileSync(path.join(draftsDir, tab1, 'draft.md'), 'Hello A', 'utf-8')
      fs.writeFileSync(path.join(draftsDir, tab2, 'draft.md'), 'Hello B', 'utf-8')

      const orphans = await findOrphanedDrafts()

      // Cleanup
      fs.rmSync(path.join(draftsDir, tab1), { recursive: true, force: true })
      fs.rmSync(path.join(draftsDir, tab2), { recursive: true, force: true })

      return {
        tab1Entry: orphans.find((o: any) => o.tabId === tab1) || null,
        tab2Entry: orphans.find((o: any) => o.tabId === tab2) || null
      }
    })

    expect(result.tab1Entry).not.toBeNull()
    expect(result.tab2Entry).not.toBeNull()
    expect(result.tab1Entry!.content).toBe('Hello A')
    expect(result.tab2Entry!.content).toBe('Hello B')
    expect(typeof result.tab1Entry!.lastModified).toBe('number')
    expect(result.tab1Entry!.lastModified).toBeGreaterThan(0)
  })

  test('skips drafts whose content is empty or whitespace-only', async ({ electronApp }) => {
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const draftsDir = path.join(os.homedir(), '.wrangle', 'drafts')
      const { findOrphanedDrafts } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      const emptyTab = '__crr003_empty__'
      const whitespaceTab = '__crr003_ws__'
      const validTab = '__crr003_valid__'
      fs.mkdirSync(path.join(draftsDir, emptyTab), { recursive: true })
      fs.mkdirSync(path.join(draftsDir, whitespaceTab), { recursive: true })
      fs.mkdirSync(path.join(draftsDir, validTab), { recursive: true })
      fs.writeFileSync(path.join(draftsDir, emptyTab, 'draft.md'), '', 'utf-8')
      fs.writeFileSync(path.join(draftsDir, whitespaceTab, 'draft.md'), '   \n\t  \n', 'utf-8')
      fs.writeFileSync(path.join(draftsDir, validTab, 'draft.md'), 'real content', 'utf-8')

      const orphans = await findOrphanedDrafts()
      const ids = orphans.map((o: any) => o.tabId)

      // Cleanup
      fs.rmSync(path.join(draftsDir, emptyTab), { recursive: true, force: true })
      fs.rmSync(path.join(draftsDir, whitespaceTab), { recursive: true, force: true })
      fs.rmSync(path.join(draftsDir, validTab), { recursive: true, force: true })

      return { ids, emptyTab, whitespaceTab, validTab }
    })

    expect(result.ids).toContain(result.validTab)
    expect(result.ids).not.toContain(result.emptyTab)
    expect(result.ids).not.toContain(result.whitespaceTab)
  })

  test('skips tab directories that have no draft.md at all', async ({ electronApp }) => {
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const draftsDir = path.join(os.homedir(), '.wrangle', 'drafts')
      const { findOrphanedDrafts } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      const noDraftTab = '__crr003_nodraft__'
      fs.mkdirSync(path.join(draftsDir, noDraftTab), { recursive: true })
      // No draft.md inside

      const orphans = await findOrphanedDrafts()
      const ids = orphans.map((o: any) => o.tabId)

      fs.rmSync(path.join(draftsDir, noDraftTab), { recursive: true, force: true })
      return { ids, noDraftTab }
    })

    expect(result.ids).not.toContain(result.noDraftTab)
  })

  test('returns an empty array when the drafts directory does not exist', async ({ electronApp }) => {
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const draftsDir = path.join(os.homedir(), '.wrangle', 'drafts')
      const { findOrphanedDrafts } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      // Snapshot current state to restore after
      const hadDir = fs.existsSync(draftsDir)
      let backedUp: string[] = []
      if (hadDir) {
        backedUp = fs.readdirSync(draftsDir)
        // Move aside rather than delete user data — but we're in a test env; just rename
        fs.renameSync(draftsDir, draftsDir + '.bak-crr003')
      }

      const orphans = await findOrphanedDrafts()

      // Restore
      if (hadDir) {
        if (fs.existsSync(draftsDir)) {
          fs.rmSync(draftsDir, { recursive: true, force: true })
        }
        fs.renameSync(draftsDir + '.bak-crr003', draftsDir)
      }

      return { orphans, restoredCount: backedUp.length }
    })

    expect(Array.isArray(result.orphans)).toBe(true)
    expect(result.orphans).toEqual([])
  })

  test('does not throw when an entry is unreadable (swallowed)', async ({ electronApp }) => {
    // We cannot reliably produce an unreadable file cross-platform, so we assert
    // the weaker contract: findOrphanedDrafts never throws even when odd entries
    // are present (e.g. a file where a tab directory is expected).
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const draftsDir = path.join(os.homedir(), '.wrangle', 'drafts')
      const { findOrphanedDrafts } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      // Plant a non-directory child named like a tab
      const weirdEntry = '__crr003_file_not_dir__'
      fs.mkdirSync(draftsDir, { recursive: true })
      fs.writeFileSync(path.join(draftsDir, weirdEntry), 'not a dir', 'utf-8')

      let threw = false
      let orphans: any[] = []
      try {
        orphans = await findOrphanedDrafts()
      } catch {
        threw = true
      }

      // Cleanup
      fs.unlinkSync(path.join(draftsDir, weirdEntry))
      return { threw, includesWeird: orphans.some((o: any) => o.tabId === weirdEntry) }
    })

    expect(result.threw).toBe(false)
    expect(result.includesWeird).toBe(false)
  })
})
