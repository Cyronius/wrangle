/**
 * window-drag-diagnostic.spec.ts
 *
 * Diagnostic tests designed to FAIL and demonstrate the actual broken behaviors
 * that existing tests miss. These tests verify ACTUAL window position and state
 * from the main process — never debug API counters for pass/fail.
 *
 * Broken behaviors reported by user:
 *   1. Non-maximized Alt+drag doesn't move the window
 *   2. Alt+drag from maximized doesn't move the window (unmaximizes but stays put)
 *   3. No re-maximize on release after dragging from maximized
 *
 * Why existing 24 tests pass despite these being broken:
 *   - WD-COORD-001/002 verify __dragDebug counters, not actual position
 *   - ±30-40px tolerances mask partial or zero movement
 *   - XWayland workarounds sidestep the real issue
 *   - Tests verify state machine transitions, not physical outcomes
 */

import { test, expect, waitForAppLoaded } from '../fixtures'
import { ElectronApplication, Page } from '@playwright/test'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getWinState(app: ElectronApplication) {
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const [x, y] = win.getPosition()
    const [width, height] = win.getSize()
    return { x, y, width, height, maximized: win.isMaximized() }
  })
}

async function forceState(
  app: ElectronApplication,
  opts: { x?: number; y?: number; w?: number; h?: number; maximized?: boolean }
) {
  await app.evaluate(({ BrowserWindow }, o) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (o.maximized === false && win.isMaximized()) win.unmaximize()
    if (o.maximized !== true) {
      if (o.w !== undefined && o.h !== undefined) win.setSize(o.w, o.h)
      if (o.x !== undefined && o.y !== undefined) win.setPosition(o.x, o.y)
    }
    if (o.maximized === true && !win.isMaximized()) win.maximize()
  }, opts)
  await new Promise(r => setTimeout(r, 300))
}

async function getDragDebug(page: Page) {
  return page.evaluate(() => {
    const d = (window as any).__dragDebug
    if (!d) return null
    return {
      dragging: d.dragging,
      pending: d.pending,
      unmaximizing: d.unmaximizing,
      wasMax: d.wasMax,
      altHeld: d.altHeld,
      mouseButton: d.mouseButton,
      moveCalls: d.moveCalls,
      setPosCalls: d.setPosCalls,
      lastDelta: d.lastDelta,
      lastScreenX: d.lastScreenX,
      dragStart: d.dragStart,
      reAnchor: d.reAnchor,
    }
  })
}

// ─── DIAG-001: setPosition IPC smoke test ────────────────────────────────────
// Calls setPosition directly — bypasses the hook entirely.
// If this fails, the IPC layer itself is broken.

test('DIAG-001: setPosition IPC directly moves window', async ({ electronApp, window }) => {
  await waitForAppLoaded(window)
  await forceState(electronApp, { x: 200, y: 200, w: 800, h: 600, maximized: false })

  const before = await getWinState(electronApp)
  console.log('[DIAG-001] Before:', before)

  // Call setPosition directly through the renderer's IPC bridge
  await window.evaluate(() => {
    window.electron.window.setPosition(400, 350)
  })
  await new Promise(r => setTimeout(r, 200))

  const after = await getWinState(electronApp)
  console.log('[DIAG-001] After:', after)

  const dx = after.x - before.x
  const dy = after.y - before.y
  console.log(`[DIAG-001] Delta: dx=${dx}, dy=${dy} (expected ~200, ~150)`)

  expect(Math.abs(dx - 200), `X delta should be ~200, got ${dx}`).toBeLessThan(10)
  expect(Math.abs(dy - 150), `Y delta should be ~150, got ${dy}`).toBeLessThan(10)
})

// ─── DIAG-002: Alt keydown activates debug state and overlay ─────────────────
// Baseline sanity: is the hook even mounted and responding to events?

test('DIAG-002: Alt keydown sets altHeld and shows overlay', async ({ electronApp, window }) => {
  await waitForAppLoaded(window)

  // Before Alt press
  const debugBefore = await getDragDebug(window)
  console.log('[DIAG-002] Debug before Alt:', debugBefore)
  expect(debugBefore, '__dragDebug should exist (hook mounted)').not.toBeNull()
  expect(debugBefore!.altHeld, 'altHeld should be false before Alt press').toBe(false)

  const overlayBefore = await window.$('.window-drag-overlay')
  expect(overlayBefore, 'No overlay before Alt press').toBeNull()

  // Press Alt
  await window.keyboard.down('Alt')
  await window.waitForTimeout(200)

  const debugAfter = await getDragDebug(window)
  console.log('[DIAG-002] Debug after Alt:', debugAfter)
  expect(debugAfter!.altHeld, 'altHeld should be true after Alt press').toBe(true)

  const overlayAfter = await window.$('.window-drag-overlay')
  expect(overlayAfter, 'Overlay should appear when Alt is held').toBeTruthy()

  // Release Alt
  await window.keyboard.up('Alt')
  await window.waitForTimeout(200)

  const debugFinal = await getDragDebug(window)
  console.log('[DIAG-002] Debug after Alt release:', debugFinal)
  expect(debugFinal!.altHeld, 'altHeld should be false after Alt release').toBe(false)

  const overlayFinal = await window.$('.window-drag-overlay')
  expect(overlayFinal, 'Overlay should disappear after Alt release').toBeNull()
})

// ─── DIAG-003: Non-maximized Alt+drag changes window position ────────────────
// The core test for broken behavior #1.
// Uses ±10px tolerance (not the ±40px in existing tests).

test('DIAG-003: Non-maximized Alt+drag actually moves window (tight tolerance)', async ({
  electronApp,
  window
}) => {
  await waitForAppLoaded(window)
  await forceState(electronApp, { x: 200, y: 200, w: 1000, h: 700, maximized: false })

  // Reset debug counters
  await window.evaluate(() => {
    const d = (window as any).__dragDebug
    if (d) { d.moveCalls = 0; d.setPosCalls = 0; d.lastDelta = 0 }
  })

  const before = await getWinState(electronApp)
  console.log('[DIAG-003] Before drag:', before)

  // Alt+drag: 150px right, 100px down, 15 steps
  const startX = 500, startY = 350
  const dragDx = 150, dragDy = 100

  await window.keyboard.down('Alt')
  await window.waitForTimeout(100)

  await window.mouse.move(startX, startY)
  await window.mouse.down()
  await window.waitForTimeout(100) // let async getPosition IPC complete

  const debugAfterDown = await getDragDebug(window)
  console.log('[DIAG-003] Debug after mousedown:', debugAfterDown)

  for (let i = 1; i <= 15; i++) {
    await window.mouse.move(
      startX + (dragDx * i) / 15,
      startY + (dragDy * i) / 15
    )
    await window.waitForTimeout(10)
  }
  await window.waitForTimeout(200) // let final IPC settle

  const debugAfterDrag = await getDragDebug(window)
  console.log('[DIAG-003] Debug after drag:', debugAfterDrag)

  await window.mouse.up()
  await window.keyboard.up('Alt')
  await window.waitForTimeout(100)

  const after = await getWinState(electronApp)
  console.log('[DIAG-003] After drag:', after)

  const actualDx = after.x - before.x
  const actualDy = after.y - before.y
  console.log(`[DIAG-003] Actual delta: dx=${actualDx}, dy=${actualDy} (expected ~${dragDx}, ~${dragDy})`)
  console.log(`[DIAG-003] Debug: setPosCalls=${debugAfterDrag?.setPosCalls}, lastDelta=${debugAfterDrag?.lastDelta}`)

  expect(Math.abs(actualDx - dragDx), `X delta: expected ~${dragDx}, got ${actualDx}`).toBeLessThan(10)
  expect(Math.abs(actualDy - dragDy), `Y delta: expected ~${dragDy}, got ${actualDy}`).toBeLessThan(10)
})

// ─── DIAG-004: Window position changes DURING drag ───────────────────────────
// Verifies intermediate positions, not just final position.
// Catches: setPosition calls being batched/dropped/deferred.

test('DIAG-004: Window position changes continuously during non-maximized drag', async ({
  electronApp,
  window
}) => {
  await waitForAppLoaded(window)
  await forceState(electronApp, { x: 200, y: 200, w: 1000, h: 700, maximized: false })

  const startX = 500, startY = 350
  const dragDx = 200, dragDy = 0 // horizontal only for clarity

  await window.keyboard.down('Alt')
  await window.waitForTimeout(100)
  await window.mouse.move(startX, startY)
  await window.mouse.down()
  await window.waitForTimeout(100)

  const positions: Array<{ x: number; y: number }> = []
  const initialPos = await getWinState(electronApp)
  positions.push({ x: initialPos.x, y: initialPos.y })

  // Drag in 10 steps, polling position after each
  for (let i = 1; i <= 10; i++) {
    await window.mouse.move(startX + (dragDx * i) / 10, startY)
    await window.waitForTimeout(50) // give IPC time to process
    const pos = await getWinState(electronApp)
    positions.push({ x: pos.x, y: pos.y })
  }

  await window.mouse.up()
  await window.keyboard.up('Alt')

  console.log('[DIAG-004] Polled positions:', JSON.stringify(positions))

  // Count positions that differ from the starting position by more than 5px
  const startPos = positions[0]
  const distinctPositions = positions.filter(
    p => Math.abs(p.x - startPos.x) > 5 || Math.abs(p.y - startPos.y) > 5
  )
  console.log(`[DIAG-004] Distinct positions (>5px from start): ${distinctPositions.length} out of ${positions.length}`)

  expect(
    distinctPositions.length,
    `Expected at least 3 distinct intermediate positions, got ${distinctPositions.length}`
  ).toBeGreaterThanOrEqual(3)

  // Final position should be close to expected
  const finalPos = positions[positions.length - 1]
  const finalDx = finalPos.x - startPos.x
  console.log(`[DIAG-004] Final X delta: ${finalDx} (expected ~${dragDx})`)
  expect(Math.abs(finalDx - dragDx), `Final X delta: expected ~${dragDx}, got ${finalDx}`).toBeLessThan(15)
})

// ─── DIAG-005: forceMaximize IPC smoke test ──────────────────────────────────
// Isolates whether forceMaximize IPC works independently of the drag flow.

test('DIAG-005: forceMaximize IPC maximizes a non-maximized window', async ({
  electronApp,
  window
}) => {
  await waitForAppLoaded(window)
  await forceState(electronApp, { x: 200, y: 200, w: 800, h: 600, maximized: false })

  const before = await getWinState(electronApp)
  console.log('[DIAG-005] Before forceMaximize:', before)
  expect(before.maximized, 'Should start non-maximized').toBe(false)

  // Call forceMaximize through the renderer IPC bridge
  await window.evaluate(() => {
    window.electron.window.forceMaximize()
  })
  await window.waitForTimeout(500) // generous wait for WM

  const after = await getWinState(electronApp)
  console.log('[DIAG-005] After forceMaximize:', after)

  expect(after.maximized, 'Window should be maximized after forceMaximize()').toBe(true)
})

// ─── DIAG-006: Maximized drag actually changes window position ───────────────
// Tests broken behavior #2: window unmaximizes but doesn't follow cursor.
// NO debug counter assertions — only real position.

test('DIAG-006: Maximized Alt+drag moves window after unmaximize', async ({
  electronApp,
  window
}) => {
  await waitForAppLoaded(window)
  await forceState(electronApp, { x: 100, y: 100, w: 900, h: 600, maximized: true })

  await window.evaluate(() => {
    const d = (window as any).__dragDebug
    if (d) { d.moveCalls = 0; d.setPosCalls = 0; d.lastDelta = 0 }
  })

  const before = await getWinState(electronApp)
  console.log('[DIAG-006] Before (maximized):', before)
  expect(before.maximized, 'Should start maximized').toBe(true)

  const startX = 400, startY = 50 // near top for titlebar area
  const threshold = 10 // exceed the 5px threshold
  const dragAfterUnmax = 80 // additional drag after unmaximize

  // Alt + mousedown
  await window.keyboard.down('Alt')
  await window.waitForTimeout(100)
  await window.mouse.move(startX, startY)
  await window.mouse.down()
  await window.waitForTimeout(100)

  // Move past 5px threshold to trigger unmaximize
  for (let i = 1; i <= 5; i++) {
    await window.mouse.move(startX + (threshold * i) / 5, startY)
    await window.waitForTimeout(20)
  }
  await window.waitForTimeout(500) // wait for unmaximizeForDrag IPC + WM settle

  const midState = await getWinState(electronApp)
  console.log('[DIAG-006] After unmaximize:', midState)
  expect(midState.maximized, 'Should be unmaximized after drag past threshold').toBe(false)

  const postUnmaxPos = { x: midState.x, y: midState.y }

  // Now continue dragging by dragAfterUnmax pixels
  const continueStartX = startX + threshold
  for (let i = 1; i <= 10; i++) {
    await window.mouse.move(
      continueStartX + (dragAfterUnmax * i) / 10,
      startY
    )
    await window.waitForTimeout(20)
  }
  await window.waitForTimeout(200)

  const afterDrag = await getWinState(electronApp)
  const dragDebug = await getDragDebug(window)
  console.log('[DIAG-006] After continued drag:', afterDrag)
  console.log('[DIAG-006] Debug:', dragDebug)

  const movementFromUnmax = Math.abs(afterDrag.x - postUnmaxPos.x)
  console.log(`[DIAG-006] Movement from post-unmaximize position: ${movementFromUnmax}px (expected >= 30px)`)

  await window.mouse.up()
  await window.keyboard.up('Alt')

  expect(
    movementFromUnmax,
    `Window should have moved at least 30px from post-unmaximize position, got ${movementFromUnmax}px`
  ).toBeGreaterThanOrEqual(30)
})

// ─── DIAG-007: Re-maximize on mouseup ────────────────────────────────────────
// Tests broken behavior #3: window stays non-maximized after drag release.
// Checks at multiple time points to distinguish "never re-maximizes" from "slow".

test('DIAG-007: Re-maximize on mouseup after drag from maximized', async ({
  electronApp,
  window
}) => {
  await waitForAppLoaded(window)
  await forceState(electronApp, { x: 100, y: 100, w: 900, h: 600, maximized: true })

  const before = await getWinState(electronApp)
  console.log('[DIAG-007] Before:', before)
  expect(before.maximized).toBe(true)

  const startX = 400, startY = 50

  // Alt+drag past threshold to trigger unmaximize
  await window.keyboard.down('Alt')
  await window.waitForTimeout(100)
  await window.mouse.move(startX, startY)
  await window.mouse.down()
  await window.waitForTimeout(50)

  // Drag past threshold
  for (let i = 1; i <= 5; i++) {
    await window.mouse.move(startX + i * 3, startY + i * 2)
    await window.waitForTimeout(20)
  }
  await window.waitForTimeout(500) // let unmaximize complete

  const duringDrag = await getWinState(electronApp)
  console.log('[DIAG-007] During drag:', duringDrag)
  expect(duringDrag.maximized, 'Should be unmaximized during drag').toBe(false)

  // Check debug state before mouseup
  const debugBeforeUp = await getDragDebug(window)
  console.log('[DIAG-007] Debug before mouseup:', debugBeforeUp)

  // Release mouse and alt
  await window.mouse.up()
  await window.keyboard.up('Alt')

  // Poll isMaximized at multiple time points
  const checkPoints = [200, 500, 1000]
  const results: Array<{ ms: number; maximized: boolean }> = []

  for (const ms of checkPoints) {
    await window.waitForTimeout(ms === checkPoints[0] ? ms : ms - checkPoints[checkPoints.indexOf(ms) - 1])
    const state = await getWinState(electronApp)
    results.push({ ms, maximized: state.maximized })
    console.log(`[DIAG-007] At ${ms}ms after mouseup: maximized=${state.maximized}`)
    if (state.maximized) break // no need to keep checking
  }

  console.log('[DIAG-007] Re-maximize results:', JSON.stringify(results))

  const reMaximized = results.some(r => r.maximized)
  expect(
    reMaximized,
    `Window should re-maximize within 1000ms after mouseup. Results: ${JSON.stringify(results)}`
  ).toBe(true)
})

// ─── DIAG-008: Complete lifecycle with position tracking ─────────────────────
// Full lifecycle: maximized → drag → position changes → re-maximize.
// Four phases, all verified with real physical state. No debug counters.

test('DIAG-008: Complete lifecycle - maximized, drag, move, re-maximize', async ({
  electronApp,
  window
}) => {
  await waitForAppLoaded(window)
  await forceState(electronApp, { x: 100, y: 100, w: 900, h: 600, maximized: true })

  // ── Phase 1: Starts maximized ──
  const phase1 = await getWinState(electronApp)
  console.log('[DIAG-008] Phase 1 (should be maximized):', phase1)
  expect(phase1.maximized, 'Phase 1: should start maximized').toBe(true)

  const startX = 450, startY = 50

  // Begin Alt+drag
  await window.keyboard.down('Alt')
  await window.waitForTimeout(100)
  await window.mouse.move(startX, startY)
  await window.mouse.down()
  await window.waitForTimeout(50)

  // Drag past 5px threshold
  for (let i = 1; i <= 5; i++) {
    await window.mouse.move(startX + i * 3, startY)
    await window.waitForTimeout(20)
  }
  await window.waitForTimeout(500) // wait for unmaximizeForDrag IPC

  // ── Phase 2: Should be unmaximized ──
  const phase2 = await getWinState(electronApp)
  console.log('[DIAG-008] Phase 2 (should be unmaximized):', phase2)
  expect(phase2.maximized, 'Phase 2: should be unmaximized after drag past threshold').toBe(false)

  const posAfterUnmax = { x: phase2.x, y: phase2.y }

  // ── Phase 3: Continue dragging — window should move ──
  const continueDx = 100
  const continueStartX = startX + 15 // already moved 15px for threshold
  for (let i = 1; i <= 10; i++) {
    await window.mouse.move(continueStartX + (continueDx * i) / 10, startY)
    await window.waitForTimeout(20)
  }
  await window.waitForTimeout(200)

  const phase3 = await getWinState(electronApp)
  const phase3Movement = Math.abs(phase3.x - posAfterUnmax.x)
  console.log('[DIAG-008] Phase 3 (should have moved):', phase3)
  console.log(`[DIAG-008] Phase 3 movement from unmax position: ${phase3Movement}px (expected >= 40px)`)
  expect(
    phase3Movement,
    `Phase 3: window should move at least 40px during drag, got ${phase3Movement}px`
  ).toBeGreaterThanOrEqual(40)

  // ── Phase 4: Release — should re-maximize ──
  await window.mouse.up()
  await window.keyboard.up('Alt')
  await window.waitForTimeout(500)

  const phase4 = await getWinState(electronApp)
  console.log('[DIAG-008] Phase 4 (should be re-maximized):', phase4)
  expect(phase4.maximized, 'Phase 4: should be re-maximized after mouseup').toBe(true)
})

// ─── DIAG-009: Event chain diagnostics ───────────────────────────────────────
// Injects listeners to trace what events actually arrive in the renderer.
// Compares CDP events vs sendInputEvent events.

test('DIAG-009: Event chain — compare CDP vs sendInputEvent event delivery', async ({
  electronApp,
  window
}) => {
  await waitForAppLoaded(window)
  await forceState(electronApp, { x: 200, y: 200, w: 800, h: 600, maximized: false })

  // Inject event logger
  await window.evaluate(() => {
    ;(window as any).__eventLog = []
    const log = (window as any).__eventLog
    const record = (e: Event) => {
      const ev = e as KeyboardEvent & MouseEvent
      log.push({
        type: ev.type,
        key: ev.key || null,
        keyCode: ev.keyCode || null,
        altKey: ev.altKey,
        button: ev.button ?? null,
        buttons: ev.buttons ?? null,
        screenX: ev.screenX ?? null,
        screenY: ev.screenY ?? null,
        clientX: ev.clientX ?? null,
        clientY: ev.clientY ?? null,
        target: (ev.target as HTMLElement)?.className || (ev.target as HTMLElement)?.tagName || null,
      })
    }
    window.addEventListener('keydown', record, { capture: true })
    window.addEventListener('keyup', record, { capture: true })
    window.addEventListener('mousedown', record, { capture: true })
    window.addEventListener('mousemove', record, { capture: true })
    window.addEventListener('mouseup', record, { capture: true })
  })

  // ── Part A: CDP events ──
  await window.evaluate(() => { (window as any).__eventLog.length = 0 })

  await window.keyboard.down('Alt')
  await window.waitForTimeout(50)
  await window.mouse.move(400, 300)
  await window.mouse.down()
  await window.waitForTimeout(50)
  await window.mouse.move(420, 310)
  await window.waitForTimeout(50)
  await window.mouse.up()
  await window.keyboard.up('Alt')
  await window.waitForTimeout(50)

  const cdpLog = await window.evaluate(() => (window as any).__eventLog.slice())
  console.log('[DIAG-009] CDP event log:')
  for (const e of cdpLog) {
    console.log(`  ${e.type}: key=${e.key} altKey=${e.altKey} button=${e.button} buttons=${e.buttons} screen=(${e.screenX},${e.screenY}) target=${e.target}`)
  }

  const cdpKeydown = cdpLog.find((e: any) => e.type === 'keydown' && e.key === 'Alt')
  const cdpMousedown = cdpLog.find((e: any) => e.type === 'mousedown')
  const cdpMousemove = cdpLog.filter((e: any) => e.type === 'mousemove')
  console.log(`[DIAG-009] CDP: keydown(Alt)=${!!cdpKeydown}, mousedown=${!!cdpMousedown}, mousemoves=${cdpMousemove.length}`)

  // ── Part B: sendInputEvent ──
  await window.evaluate(() => { (window as any).__eventLog.length = 0 })

  // Reset drag debug state
  await window.evaluate(() => {
    const d = (window as any).__dragDebug
    if (d) { d.moveCalls = 0; d.setPosCalls = 0; d.lastDelta = 0 }
  })

  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Alt' })
  })
  await window.waitForTimeout(100)

  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({
      type: 'mouseDown', x: 400, y: 300, button: 'left',
      modifiers: ['alt']
    })
  })
  await window.waitForTimeout(100)

  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({
      type: 'mouseMove', x: 420, y: 310,
      modifiers: ['alt']
    })
  })
  await window.waitForTimeout(100)

  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({
      type: 'mouseUp', x: 420, y: 310, button: 'left'
    })
  })
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Alt' })
  })
  await window.waitForTimeout(100)

  const sieLog = await window.evaluate(() => (window as any).__eventLog.slice())
  console.log('[DIAG-009] sendInputEvent log:')
  for (const e of sieLog) {
    console.log(`  ${e.type}: key=${e.key} altKey=${e.altKey} button=${e.button} buttons=${e.buttons} screen=(${e.screenX},${e.screenY}) target=${e.target}`)
  }

  const sieKeydown = sieLog.find((e: any) => e.type === 'keydown' && e.key === 'Alt')
  const sieMousedown = sieLog.find((e: any) => e.type === 'mousedown')
  const sieMousemove = sieLog.filter((e: any) => e.type === 'mousemove')
  console.log(`[DIAG-009] sendInputEvent: keydown(Alt)=${!!sieKeydown}, mousedown=${!!sieMousedown}, mousemoves=${sieMousemove.length}`)

  // Both methods should deliver events — if sendInputEvent doesn't, that's the bug
  expect(sieKeydown, 'sendInputEvent: Alt keydown should reach renderer').toBeTruthy()
  expect(sieMousedown, 'sendInputEvent: mousedown should reach renderer').toBeTruthy()
  expect(sieMousemove.length, 'sendInputEvent: mousemove should reach renderer').toBeGreaterThan(0)
})

// ─── DIAG-010: Non-max Alt+drag via sendInputEvent ───────────────────────────
// Same as DIAG-003 but uses sendInputEvent for all input.
// If this fails while DIAG-003 passes, the event delivery path is different.

test('DIAG-010: Non-maximized Alt+drag via sendInputEvent', async ({
  electronApp,
  window
}) => {
  await waitForAppLoaded(window)
  await forceState(electronApp, { x: 200, y: 200, w: 1000, h: 700, maximized: false })

  await window.evaluate(() => {
    const d = (window as any).__dragDebug
    if (d) { d.moveCalls = 0; d.setPosCalls = 0; d.lastDelta = 0 }
  })

  const before = await getWinState(electronApp)
  console.log('[DIAG-010] Before:', before)

  const startX = 500, startY = 350
  const dragDx = 150, dragDy = 100

  // Alt down
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Alt' })
  })
  await window.waitForTimeout(150)

  // Check if Alt registered
  const debugAfterAlt = await getDragDebug(window)
  console.log('[DIAG-010] After Alt down:', debugAfterAlt)

  // Mouse down
  await electronApp.evaluate(({ BrowserWindow }, args) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({
      type: 'mouseDown', x: args.x, y: args.y, button: 'left',
      modifiers: ['alt']
    })
  }, { x: startX, y: startY })
  await window.waitForTimeout(150)

  const debugAfterDown = await getDragDebug(window)
  console.log('[DIAG-010] After mousedown:', debugAfterDown)

  // Drag in steps
  for (let i = 1; i <= 15; i++) {
    const x = startX + Math.round((dragDx * i) / 15)
    const y = startY + Math.round((dragDy * i) / 15)
    await electronApp.evaluate(({ BrowserWindow }, args) => {
      const win = BrowserWindow.getAllWindows()[0]
      win.webContents.sendInputEvent({
        type: 'mouseMove', x: args.x, y: args.y,
        modifiers: ['alt']
      })
    }, { x, y })
    await window.waitForTimeout(15)
  }
  await window.waitForTimeout(200)

  const debugAfterDrag = await getDragDebug(window)
  console.log('[DIAG-010] After drag:', debugAfterDrag)

  // Mouse up + Alt up
  await electronApp.evaluate(({ BrowserWindow }, args) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({
      type: 'mouseUp', x: args.x, y: args.y, button: 'left'
    })
  }, { x: startX + dragDx, y: startY + dragDy })
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Alt' })
  })
  await window.waitForTimeout(100)

  const after = await getWinState(electronApp)
  console.log('[DIAG-010] After:', after)

  const actualDx = after.x - before.x
  const actualDy = after.y - before.y
  console.log(`[DIAG-010] Delta: dx=${actualDx}, dy=${actualDy} (expected ~${dragDx}, ~${dragDy})`)
  console.log(`[DIAG-010] Debug: altHeld=${debugAfterAlt?.altHeld}, dragging=${debugAfterDown?.dragging}, setPosCalls=${debugAfterDrag?.setPosCalls}`)

  // These assertions tell us exactly where the chain breaks:
  expect(debugAfterAlt?.altHeld, 'Alt should be detected via sendInputEvent').toBe(true)
  expect(debugAfterDown?.dragging, 'Dragging should activate via sendInputEvent').toBe(true)
  expect(debugAfterDrag?.setPosCalls, 'setPosition should be called during drag').toBeGreaterThan(0)
  expect(Math.abs(actualDx - dragDx), `X delta: expected ~${dragDx}, got ${actualDx}`).toBeLessThan(15)
  expect(Math.abs(actualDy - dragDy), `Y delta: expected ~${dragDy}, got ${actualDy}`).toBeLessThan(15)
})

// ─── DIAG-011: Alt keydown via sendInputEvent ────────────────────────────────
// Isolated test: does sendInputEvent Alt keydown set altHeldRef and show overlay?

test('DIAG-011: Alt keydown via sendInputEvent sets altHeld and overlay', async ({
  electronApp,
  window
}) => {
  await waitForAppLoaded(window)

  const debugBefore = await getDragDebug(window)
  console.log('[DIAG-011] Before:', debugBefore)
  expect(debugBefore?.altHeld).toBe(false)

  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Alt' })
  })
  await window.waitForTimeout(300)

  const debugAfter = await getDragDebug(window)
  console.log('[DIAG-011] After sendInputEvent Alt:', debugAfter)

  const overlay = await window.$('.window-drag-overlay')
  console.log('[DIAG-011] Overlay present:', !!overlay)

  expect(debugAfter?.altHeld, 'altHeld should be true after sendInputEvent Alt keydown').toBe(true)
  expect(overlay, 'Overlay should appear after sendInputEvent Alt keydown').toBeTruthy()

  // Cleanup
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Alt' })
  })
})

// ─── DIAG-012: mousedown e.altKey property ───────────────────────────────────
// Tests whether mousedown events carry e.altKey=true when Alt is held.

test('DIAG-012: mousedown carries e.altKey=true with sendInputEvent', async ({
  electronApp,
  window
}) => {
  await waitForAppLoaded(window)
  await forceState(electronApp, { x: 200, y: 200, w: 800, h: 600, maximized: false })

  // Install listener to capture mousedown properties
  await window.evaluate(() => {
    ;(window as any).__mousedownLog = []
    window.addEventListener('mousedown', (e) => {
      (window as any).__mousedownLog.push({
        altKey: e.altKey,
        button: e.button,
        buttons: e.buttons,
        clientX: e.clientX,
        clientY: e.clientY,
      })
    }, { capture: true })
  })

  // Send Alt + mousedown via sendInputEvent
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Alt' })
  })
  await window.waitForTimeout(100)

  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({
      type: 'mouseDown', x: 400, y: 300, button: 'left',
      modifiers: ['alt']
    })
  })
  await window.waitForTimeout(100)

  const mousedownLog = await window.evaluate(() => (window as any).__mousedownLog)
  console.log('[DIAG-012] mousedown events:', JSON.stringify(mousedownLog))

  const dragDebug = await getDragDebug(window)
  console.log('[DIAG-012] dragDebug:', dragDebug)

  expect(mousedownLog.length, 'At least one mousedown event should fire').toBeGreaterThan(0)

  const lastDown = mousedownLog[mousedownLog.length - 1]
  console.log(`[DIAG-012] mousedown altKey=${lastDown?.altKey}, button=${lastDown?.button}`)
  expect(lastDown?.altKey, 'mousedown should have altKey=true').toBe(true)
  expect(lastDown?.button, 'mousedown should be left button (0)').toBe(0)

  // Cleanup
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({ type: 'mouseUp', x: 400, y: 300, button: 'left' })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Alt' })
  })
})

// ─── DIAG-013: Drag without overlay ──────────────────────────────────────────
// Hides the overlay via CSS injection, then performs Alt+drag.
// If this works while DIAG-010 fails, the overlay is blocking real events.

test('DIAG-013: Alt+drag works when overlay is hidden via CSS', async ({
  electronApp,
  window
}) => {
  await waitForAppLoaded(window)
  await forceState(electronApp, { x: 200, y: 200, w: 1000, h: 700, maximized: false })

  // Inject CSS to hide overlay
  await window.evaluate(() => {
    const style = document.createElement('style')
    style.id = '__diag-013-style'
    style.textContent = '.window-drag-overlay { display: none !important; pointer-events: none !important; }'
    document.head.appendChild(style)
  })

  await window.evaluate(() => {
    const d = (window as any).__dragDebug
    if (d) { d.moveCalls = 0; d.setPosCalls = 0; d.lastDelta = 0 }
  })

  const before = await getWinState(electronApp)
  console.log('[DIAG-013] Before:', before)

  const startX = 500, startY = 350
  const dragDx = 150, dragDy = 100

  // Use sendInputEvent for more realistic input
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Alt' })
  })
  await window.waitForTimeout(150)

  await electronApp.evaluate(({ BrowserWindow }, args) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({
      type: 'mouseDown', x: args.x, y: args.y, button: 'left',
      modifiers: ['alt']
    })
  }, { x: startX, y: startY })
  await window.waitForTimeout(150)

  for (let i = 1; i <= 15; i++) {
    const x = startX + Math.round((dragDx * i) / 15)
    const y = startY + Math.round((dragDy * i) / 15)
    await electronApp.evaluate(({ BrowserWindow }, args) => {
      const win = BrowserWindow.getAllWindows()[0]
      win.webContents.sendInputEvent({
        type: 'mouseMove', x: args.x, y: args.y,
        modifiers: ['alt']
      })
    }, { x, y })
    await window.waitForTimeout(15)
  }
  await window.waitForTimeout(200)

  const debugAfterDrag = await getDragDebug(window)
  console.log('[DIAG-013] After drag (overlay hidden):', debugAfterDrag)

  await electronApp.evaluate(({ BrowserWindow }, args) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({ type: 'mouseUp', x: args.x, y: args.y, button: 'left' })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Alt' })
  }, { x: startX + dragDx, y: startY + dragDy })
  await window.waitForTimeout(100)

  const after = await getWinState(electronApp)
  const actualDx = after.x - before.x
  const actualDy = after.y - before.y
  console.log(`[DIAG-013] Delta: dx=${actualDx}, dy=${actualDy} (expected ~${dragDx}, ~${dragDy})`)

  // Cleanup injected style
  await window.evaluate(() => {
    document.getElementById('__diag-013-style')?.remove()
  })

  expect(Math.abs(actualDx - dragDx), `X delta: expected ~${dragDx}, got ${actualDx}`).toBeLessThan(15)
  expect(Math.abs(actualDy - dragDy), `Y delta: expected ~${dragDy}, got ${actualDy}`).toBeLessThan(15)
})

// ─── DIAG-014: Handler invocation check via sendInputEvent ───────────────────
// After Alt+mousedown via sendInputEvent, verifies dragStartRef and draggingRef
// are set. If not, the handler is not executing or early-returning.

test('DIAG-014: Handler invocation — dragStartRef set after sendInputEvent mousedown', async ({
  electronApp,
  window
}) => {
  await waitForAppLoaded(window)
  await forceState(electronApp, { x: 200, y: 200, w: 800, h: 600, maximized: false })

  const debugBefore = await getDragDebug(window)
  console.log('[DIAG-014] Before:', debugBefore)
  expect(debugBefore?.dragging, 'Should not be dragging initially').toBe(false)
  expect(debugBefore?.dragStart, 'dragStart should be null initially').toBeNull()

  // Alt down via sendInputEvent
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Alt' })
  })
  await window.waitForTimeout(200)

  const debugAfterAlt = await getDragDebug(window)
  console.log('[DIAG-014] After Alt:', debugAfterAlt)

  // Mouse down via sendInputEvent
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({
      type: 'mouseDown', x: 400, y: 300, button: 'left',
      modifiers: ['alt']
    })
  })
  // Wait for async IPC (isMaximized + getPosition)
  await window.waitForTimeout(300)

  const debugAfterDown = await getDragDebug(window)
  console.log('[DIAG-014] After mousedown:', debugAfterDown)

  expect(debugAfterDown?.altHeld, 'altHeld should be true').toBe(true)
  expect(debugAfterDown?.mouseButton, 'mouseButton should be true').toBe(true)
  expect(debugAfterDown?.dragging, 'dragging should be true after mousedown').toBe(true)
  expect(debugAfterDown?.dragStart, 'dragStart should be set after mousedown').not.toBeNull()

  if (debugAfterDown?.dragStart) {
    console.log(`[DIAG-014] dragStart: mouseScreenX=${debugAfterDown.dragStart.mouseScreenX}, windowX=${debugAfterDown.dragStart.windowX}`)
  }

  // Cleanup
  await electronApp.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.sendInputEvent({ type: 'mouseUp', x: 400, y: 300, button: 'left' })
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Alt' })
  })
})
