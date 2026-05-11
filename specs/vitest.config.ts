import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, 'setup.ts')],
    include: ['specs/**/tests/**/*.test.ts']
  },
  resolve: {
    alias: {
      'monaco-editor': path.resolve(__dirname, 'mocks/monaco-editor.ts')
    }
  }
})
