import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false, // Electron tests should run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for Electron tests
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000
  },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts'
    }
  ]
})
