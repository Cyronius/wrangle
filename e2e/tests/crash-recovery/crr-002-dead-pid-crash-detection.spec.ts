// Traces: CRR-002 (canonical spec: specs/crash-recovery/spec.md)
import { test, expect } from '../../fixtures'

/**
 * didCrashLastSession is called exactly once on startup, before the new marker is
 * written. Since the fixture has already booted the app, we re-invoke the pure
 * function under controlled marker states to exercise each branch.
 */
test.describe('CRR-002: Dead-PID Crash Detection', () => {
  test('returns false when the marker file does not exist', async ({ electronApp }) => {
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')
      const { didCrashLastSession, createRunningMarker } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      if (fs.existsSync(markerPath)) {
        fs.unlinkSync(markerPath)
      }
      const crashed = didCrashLastSession()
      // Restore so app lifecycle invariants hold
      await createRunningMarker()
      return { crashed }
    })

    expect(result.crashed).toBe(false)
  })

  test('treats a marker with non-numeric content as a crash', async ({ electronApp }) => {
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')
      const { didCrashLastSession, createRunningMarker } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      fs.writeFileSync(markerPath, 'garbage', 'utf-8')
      const crashed = didCrashLastSession()
      await createRunningMarker()
      return { crashed }
    })

    expect(result.crashed).toBe(true)
  })

  test('treats marker matching current process.pid as a crash (conservative)', async ({ electronApp }) => {
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')
      const { didCrashLastSession } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      // Marker already contains our PID from startup; verify explicitly
      fs.writeFileSync(markerPath, String(process.pid), 'utf-8')
      const crashed = didCrashLastSession()
      return { crashed }
    })

    expect(result.crashed).toBe(true)
  })

  test('returns true when marker PID is dead (ESRCH)', async ({ electronApp }) => {
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')
      const { didCrashLastSession, createRunningMarker } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      // Use a PID that is almost certainly dead: max positive int32.
      // Verify it's actually dead from this process's view.
      const DEAD_PID = 2147483640
      let actuallyDead = false
      try {
        process.kill(DEAD_PID, 0)
      } catch (e: any) {
        if (e.code === 'ESRCH') actuallyDead = true
      }

      fs.writeFileSync(markerPath, String(DEAD_PID), 'utf-8')
      const crashed = didCrashLastSession()
      await createRunningMarker()
      return { crashed, actuallyDead }
    })

    // Only assert the branch when the PID we picked is actually dead
    expect(result.actuallyDead).toBe(true)
    expect(result.crashed).toBe(true)
  })

  test('returns false when marker PID is a different live process', async ({ electronApp }) => {
    const result = await electronApp.evaluate(async () => {
      const os = require('os')
      const path = require('path')
      const fs = require('fs')
      const { spawn } = require('child_process')
      const markerPath = path.join(os.homedir(), '.wrangle', '.running')
      const { didCrashLastSession, createRunningMarker } = require(
        path.join(__dirname, 'utils', 'crash-recovery.js')
      )

      // Spawn a long-lived child we can use as a "different live PID"
      const child = process.platform === 'win32'
        ? spawn('cmd.exe', ['/c', 'pause'], { detached: true, stdio: 'ignore' })
        : spawn('sleep', ['30'], { detached: true, stdio: 'ignore' })
      child.unref()

      const otherPid = child.pid
      fs.writeFileSync(markerPath, String(otherPid), 'utf-8')
      const crashed = didCrashLastSession()

      // Cleanup
      try { process.kill(otherPid, 'SIGKILL') } catch {}
      await createRunningMarker()
      return { crashed, otherPid }
    })

    expect(result.otherPid).toBeGreaterThan(0)
    expect(result.crashed).toBe(false)
  })
})
