// Stub the renderer-side electron preload bridge so registry command modules
// that touch `window.electron` at import or call time don't crash in jsdom.
// Tests that need to assert IPC behavior should mock the relevant subset
// in-test rather than relying on this default.
const noop = () => {}
const noopAsync = async () => {}

;(globalThis as any).window = (globalThis as any).window || globalThis
;(globalThis as any).window.electron = {
  file: {
    open: noopAsync,
    readByPath: noopAsync,
    save: noopAsync,
    saveAs: noopAsync,
    copyImage: noopAsync
  },
  window: {
    minimize: noop,
    maximize: noop,
    close: noop,
    print: noop,
    zoom: noop,
    resetZoom: noop,
    toggleDevTools: noop,
    reload: noop,
    forceReload: noop,
    toggleFullscreen: noop
  },
  shell: { showItemInFolder: noop },
  shortcuts: { publishBindings: noop },
  settings: { get: noopAsync, set: noopAsync, getAll: noopAsync },
  workspace: {
    loadDefaultSession: noopAsync,
    loadAppSession: noopAsync,
    loadSession: noopAsync,
    loadConfig: noopAsync
  },
  crashRecovery: { check: noopAsync },
  onMenuCommand: () => noop
}
