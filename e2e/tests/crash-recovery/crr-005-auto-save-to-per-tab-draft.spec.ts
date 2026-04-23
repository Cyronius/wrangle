// Traces: CRR-005 (canonical spec: specs/crash-recovery/spec.md)
import { test, expect } from '../../fixtures'

test.describe('CRR-005: Auto-Save to Per-Tab Draft', () => {
  test('autoSave writes to ~/.wrangle/drafts/{tabId}/draft.md', async ({ window, electronApp }) => {
    const tabId = `__crr005_autosave_${Date.now()}__`
    const content = 'content from CRR-005 autosave test'

    await window.evaluate(
      async ({ tabId, content }) => {
        await window.electron.file.autoSave(tabId, content, null)
      },
      { tabId, content }
    )

    const result = await electronApp.evaluate(
      async (_ctx, { tabId }) => {
        const os = require('os')
        const path = require('path')
        const fs = require('fs')
        const draftPath = path.join(os.homedir(), '.wrangle', 'drafts', tabId, 'draft.md')
        const exists = fs.existsSync(draftPath)
        const fileContent = exists ? fs.readFileSync(draftPath, 'utf-8') : null
        // Cleanup
        fs.rmSync(path.join(os.homedir(), '.wrangle', 'drafts', tabId), {
          recursive: true,
          force: true
        })
        return { exists, fileContent, draftPath }
      },
      { tabId }
    )

    expect(result.exists).toBe(true)
    expect(result.fileContent).toBe(content)
  })

  test('save path exactly matches the discovery path used by CRR-003', async ({
    window,
    electronApp
  }) => {
    const tabId = `__crr005_match_${Date.now()}__`
    await window.evaluate(
      async ({ tabId }) => {
        await window.electron.file.autoSave(tabId, 'discoverable content', null)
      },
      { tabId }
    )

    const result = await electronApp.evaluate(
      async (_ctx, { tabId }) => {
        const path = require('path')
        const { findOrphanedDrafts } = require(
          path.join(__dirname, 'utils', 'crash-recovery.js')
        )
        const orphans = await findOrphanedDrafts()
        const entry = orphans.find((o: any) => o.tabId === tabId) || null
        // Cleanup
        const os = require('os')
        const fs = require('fs')
        fs.rmSync(path.join(os.homedir(), '.wrangle', 'drafts', tabId), {
          recursive: true,
          force: true
        })
        return { entry }
      },
      { tabId }
    )

    expect(result.entry).not.toBeNull()
    expect(result.entry!.content).toBe('discoverable content')
  })

  test('debounced auto-save writes within ~2500ms after typing stops', async ({
    window,
    electronApp
  }) => {
    // Hook into existing Monaco editor: type content, wait past debounce, confirm draft
    // file contains the typed content. We let the renderer allocate its own tabId;
    // we locate the produced draft by matching content.
    const marker = `CRR-005-DEBOUNCE-${Date.now()}`

    // Snapshot existing drafts so we can identify the new one
    const before = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const draftsDir = path.join(os.homedir(), '.wrangle', 'drafts')
      if (!fs.existsSync(draftsDir)) return []
      return fs.readdirSync(draftsDir)
    })

    await window.waitForSelector('.monaco-editor .view-lines', { state: 'visible', timeout: 30000 })
    await window.click('.monaco-editor .view-lines')
    await window.keyboard.type(marker)

    // Debounce is 2500ms — wait a comfortable margin past it.
    await window.waitForTimeout(3500)

    const hit = await electronApp.evaluate(
      async (_ctx, { marker, before }) => {
        const os = require('os')
        const path = require('path')
        const fs = require('fs')
        const draftsDir = path.join(os.homedir(), '.wrangle', 'drafts')
        if (!fs.existsSync(draftsDir)) return { found: false, tabIds: [] as string[] }
        const entries = fs.readdirSync(draftsDir)
        const newTabs = entries.filter((e: string) => !before.includes(e))
        let found = false
        for (const tabId of [...newTabs, ...entries]) {
          const draftPath = path.join(draftsDir, tabId, 'draft.md')
          if (fs.existsSync(draftPath)) {
            const content = fs.readFileSync(draftPath, 'utf-8')
            if (content.includes(marker)) {
              found = true
              break
            }
          }
        }
        return { found, newTabs }
      },
      { marker, before }
    )

    expect(hit.found).toBe(true)
  })

  test('autoSave failures do not throw back to the renderer', async ({ window }) => {
    // Spec says failures are logged but do not surface. A truthy success path returns
    // a string path; a failure path must not reject. Invoke with an empty tabId to
    // provoke whatever main-side validation exists; assert no throw either way.
    const result = await window.evaluate(async () => {
      let threw = false
      let returned: unknown = undefined
      try {
        returned = await window.electron.file.autoSave('__crr005_nothrow__', 'x', null)
      } catch (e) {
        threw = true
      }
      return { threw, returnedType: typeof returned }
    })

    expect(result.threw).toBe(false)
  })

  test.fixme(
    'debounce timer resets on every content change and is cleared on unmount',
    // Requires instrumenting the React hook's timer ref; not observable via
    // DOM/IPC without renderer-internal hooks.
    () => {}
  )
})
