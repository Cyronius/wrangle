// Traces: CRR-001 (canonical spec: specs/crash-recovery/spec.md)
import { test, expect } from '../../fixtures'

test.describe('CRR-001: Running Marker Lifecycle', () => {
  test('creates ~/.wrangle/.running with the current PID on startup', async ({ electronApp }) => {
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')
      const exists = fs.existsSync(markerPath)
      const content = exists ? fs.readFileSync(markerPath, 'utf-8').trim() : null
      return { exists, content, pid: process.pid }
    })

    expect(result.exists).toBe(true)
    expect(result.content).toBe(String(result.pid))
  })

  test('createRunningMarker writes current process.pid as UTF-8', async ({ electronApp }) => {
    // Re-invoke createRunningMarker via the main module and verify contents
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')

      // Overwrite with known value
      fs.writeFileSync(markerPath, 'bogus-value', 'utf-8')
      // Re-create
      const { createRunningMarker } = require(path.join(__dirname, 'utils', 'crash-recovery.js'))
      await createRunningMarker()

      const content = fs.readFileSync(markerPath, 'utf-8')
      return { content, pid: process.pid }
    })

    expect(result.content).toBe(String(result.pid))
  })

  test('clearRunningMarker unlinks the marker; is a no-op when absent', async ({ electronApp }) => {
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')
      const { clearRunningMarker, createRunningMarker } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      // Ensure present, then clear
      if (!fs.existsSync(markerPath)) {
        await createRunningMarker()
      }
      await clearRunningMarker()
      const afterFirstClear = fs.existsSync(markerPath)

      // Calling clear again must not throw
      let threw = false
      try {
        await clearRunningMarker()
      } catch {
        threw = true
      }
      const afterSecondClear = fs.existsSync(markerPath)

      // Restore the marker so the app continues normal lifecycle
      await createRunningMarker()

      return { afterFirstClear, afterSecondClear, threw }
    })

    expect(result.afterFirstClear).toBe(false)
    expect(result.afterSecondClear).toBe(false)
    expect(result.threw).toBe(false)
  })

  test('clearRunningMarker swallows errors (best-effort)', async ({ electronApp }) => {
    // Force a scenario that would normally error (missing file) and verify no throw.
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')
      const { clearRunningMarker, createRunningMarker } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      if (fs.existsSync(markerPath)) {
        fs.unlinkSync(markerPath)
      }

      let threw = false
      try {
        await clearRunningMarker()
      } catch {
        threw = true
      }

      // Restore marker so teardown/graceful-shutdown paths remain consistent
      await createRunningMarker()
      return { threw }
    })

    expect(result.threw).toBe(false)
  })

  test('readRunningMarkerPid returns the stored PID', async ({ electronApp }) => {
    const { pid, currentPid } = await electronApp.evaluate(async () => {
      const path = require('path')
      const { readRunningMarkerPid } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )
      return { pid: readRunningMarkerPid(), currentPid: process.pid }
    })

    expect(pid).toBe(currentPid)
  })

  test('readRunningMarkerPid returns null when marker is missing', async ({ electronApp }) => {
    const { pidWhenMissing } = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')
      const { readRunningMarkerPid, createRunningMarker } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      if (fs.existsSync(markerPath)) {
        fs.unlinkSync(markerPath)
      }
      const pidWhenMissing = readRunningMarkerPid()
      // Restore
      await createRunningMarker()
      return { pidWhenMissing }
    })

    expect(pidWhenMissing).toBeNull()
  })

  test('readRunningMarkerPid returns null when content is non-numeric', async ({ electronApp }) => {
    const { pid } = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')
      const { readRunningMarkerPid, createRunningMarker } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      fs.writeFileSync(markerPath, 'not-a-pid', 'utf-8')
      const pid = readRunningMarkerPid()
      // Restore valid marker
      await createRunningMarker()
      return { pid }
    })

    expect(pid).toBeNull()
  })
})
