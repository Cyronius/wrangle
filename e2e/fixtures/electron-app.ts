import {
  test as base,
  _electron as electron,
  ElectronApplication,
  Page
} from '@playwright/test'
import path from 'path'

// Define custom fixture types
export type ElectronFixtures = {
  electronApp: ElectronApplication
  window: Page
}

// Extend base test with Electron fixtures
export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    // Path to the built main process entry
    const appPath = path.resolve(__dirname, '../../out/main/index.js')

    // Path to the Electron executable
    const electronPath = path.resolve(__dirname, '../../node_modules/electron/dist/electron.exe')

    // Create a clean environment without ELECTRON_RUN_AS_NODE
    const cleanEnv = { ...process.env }
    delete cleanEnv.ELECTRON_RUN_AS_NODE

    // Launch Electron app using the electron executable
    const electronApp = await electron.launch({
      executablePath: electronPath,
      args: [appPath],
      env: {
        ...cleanEnv,
        NODE_ENV: 'test'
      }
    })

    // Use the app
    await use(electronApp)

    // Cleanup
    await electronApp.close()
  },

  window: async ({ electronApp }, use) => {
    // Wait for the first window to open
    const window = await electronApp.firstWindow()

    // Wait for the window to be fully loaded
    await window.waitForLoadState('domcontentloaded')

    // Use the window
    await use(window)
  }
})

export { expect } from '@playwright/test'
