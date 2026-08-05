import { Page, ElectronApplication } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * Helper class for workspace operations in E2E tests
 */
export class WorkspaceHelpers {
  constructor(
    private page: Page,
    private electronApp: ElectronApplication
  ) {}

  /**
   * Create a test workspace folder with markdown files
   * @param name - Workspace name (used for folder name)
   * @param fileCount - Number of test files to create
   * @returns Path to the created workspace folder
   */
  async createTestWorkspace(name: string, fileCount: number = 1): Promise<string> {
    const tempDir = path.join(__dirname, '../../test-temp')
    const workspacePath = path.join(tempDir, name)

    // Create workspace directory
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true })
    }

    // Create workspace config file
    const configPath = path.join(workspacePath, '.wrangle', 'config.json')
    const configDir = path.dirname(configPath)
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    const workspaceId = `test-workspace-${name}-${Date.now()}`
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
    const colorIndex = Math.abs(name.charCodeAt(0)) % colors.length

    fs.writeFileSync(configPath, JSON.stringify({
      id: workspaceId,
      name: name,
      color: colors[colorIndex],
      showHiddenFiles: false
    }, null, 2))

    // Create test markdown files
    for (let i = 1; i <= fileCount; i++) {
      const fileName = `test-file-${i}.md`
      const filePath = path.join(workspacePath, fileName)
      fs.writeFileSync(filePath, `# Test File ${i}\n\nThis is test file ${i} in workspace ${name}.\n`)
    }

    return workspacePath
  }

  /**
   * Reset the app to a clean baseline: close all tabs and collapse to just the
   * default workspace. Neutralizes persisted-session bleed across test launches.
   */
  async resetAppState(): Promise<void> {
    await this.page.evaluate(() => {
      const store = (window as unknown as {
        __REDUX_STORE__?: {
          getState: () => {
            tabs: { tabs: Array<{ id: string }> }
            workspaces: { workspaces: Array<{ id: string }> }
          }
          dispatch: (action: unknown) => void
        }
      }).__REDUX_STORE__
      if (!store) return
      const state = store.getState()
      // Close every open tab
      for (const tab of state.tabs.tabs) {
        store.dispatch({ type: 'tabs/closeTab', payload: tab.id })
      }
      // Collapse to just the default workspace
      store.dispatch({ type: 'workspaces/loadWorkspaces', payload: [] })
      store.dispatch({ type: 'workspaces/setActiveWorkspace', payload: '__default__' })
    })
    await this.page.waitForTimeout(100)
  }

  /**
   * Read a workspace's id from its on-disk config.
   */
  getWorkspaceId(workspacePath: string): string {
    const configPath = path.join(path.resolve(workspacePath), '.wrangle', 'config.json')
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')).id as string
  }

  /**
   * Add a workspace to the app by simulating folder selection
   */
  async addWorkspaceToApp(workspacePath: string): Promise<void> {
    const absolutePath = path.resolve(workspacePath)

    // Read the workspace config
    const configPath = path.join(absolutePath, '.wrangle', 'config.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

    // Dispatch addWorkspace action via evaluate
    await this.page.evaluate(({ config: cfg, path: wsPath }) => {
      const store = (window as unknown as { __REDUX_STORE__?: { dispatch: (action: unknown) => void } }).__REDUX_STORE__
      if (store) {
        store.dispatch({
          type: 'workspaces/addWorkspace',
          payload: {
            id: cfg.id,
            name: cfg.name,
            color: cfg.color,
            rootPath: wsPath,
            isExpanded: true,
            showHiddenFiles: cfg.showHiddenFiles !== false,
            visibleInTabBar: true
          }
        })
        // Also set it as active
        store.dispatch({
          type: 'workspaces/setActiveWorkspace',
          payload: cfg.id
        })
      }
    }, { config, path: absolutePath })
  }

  /**
   * Open a file in a workspace to create a tab
   */
  async openFileInWorkspace(workspacePath: string, fileName: string): Promise<void> {
    const absolutePath = path.resolve(workspacePath)
    const filePath = path.join(absolutePath, fileName)
    const content = fs.readFileSync(filePath, 'utf-8')

    // Read workspace config to get workspace ID
    const configPath = path.join(absolutePath, '.wrangle', 'config.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

    // Dispatch addTab action
    await this.page.evaluate(({ wsId, fPath, fContent, fName }) => {
      const store = (window as unknown as { __REDUX_STORE__?: { dispatch: (action: unknown) => void } }).__REDUX_STORE__
      if (store) {
        const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        store.dispatch({
          type: 'tabs/addTab',
          payload: {
            id: tabId,
            filename: fName,
            content: fContent,
            path: fPath,
            workspaceId: wsId,
            isDirty: false,
            isSaved: true
          }
        })
        // Set it as active tab
        store.dispatch({
          type: 'tabs/setActiveTab',
          payload: tabId
        })
      }
    }, { wsId: config.id, fPath: filePath, fContent: content, fName: fileName })
  }

  /**
   * Get the number of visible tab groups in the tab bar
   */
  async getVisibleTabGroupCount(): Promise<number> {
    return this.page.evaluate(() => {
      return document.querySelectorAll('.tab-bar .tab-group').length
    })
  }

  /**
   * Count workspaces that occupy the editor: visibleInTabBar === true AND have at
   * least one open tab. Reads Redux directly so it is independent of the tab-bar
   * vs. multi-pane rendering architecture.
   */
  async getEditorWorkspaceCount(): Promise<number> {
    return this.page.evaluate(() => {
      const store = (window as unknown as {
        __REDUX_STORE__?: {
          getState: () => {
            workspaces: { workspaces: Array<{ id: string; visibleInTabBar: boolean }> }
            tabs: { tabs: Array<{ workspaceId: string }> }
          }
        }
      }).__REDUX_STORE__
      if (!store) return 0
      const state = store.getState()
      const withTabs = new Set(state.tabs.tabs.map((t) => t.workspaceId))
      return state.workspaces.workspaces.filter(
        (w) => w.visibleInTabBar && withTabs.has(w.id)
      ).length
    })
  }

  /**
   * Get all visible tab groups with their workspace IDs
   */
  async getVisibleTabGroups(): Promise<Array<{ workspaceId: string; width: number }>> {
    return this.page.evaluate(() => {
      const groups = document.querySelectorAll('.tab-bar .tab-group')
      return Array.from(groups).map((group) => {
        const rect = group.getBoundingClientRect()
        return {
          workspaceId: (group as HTMLElement).dataset.workspaceId || '',
          width: rect.width
        }
      })
    })
  }

  /**
   * Click a workspace in the sidebar by name
   */
  async clickWorkspaceInSidebar(workspaceName: string): Promise<void> {
    await this.page.click(`.workspace-bar-item:has-text("${workspaceName}")`)
    await this.page.waitForTimeout(100) // Wait for state update
  }

  /**
   * WTB-013: Hide a workspace via the explorer header hide button. Activates the
   * named workspace first (so the explorer shows it), then clicks the hide button.
   */
  async hideWorkspaceFromHeader(workspaceName: string): Promise<void> {
    await this.clickWorkspaceInSidebar(workspaceName)
    await this.page.click('.sidebar-workspace-hide')
    await this.page.waitForTimeout(100)
  }

  /**
   * WTB-013: Whether the explorer header hide button is disabled (last-visible).
   */
  async isHeaderHideDisabled(): Promise<boolean> {
    return this.page.evaluate(() => {
      const btn = document.querySelector('.sidebar-workspace-hide') as HTMLButtonElement | null
      return btn ? btn.disabled : false
    })
  }

  /**
   * Open a file from the active workspace's file tree by clicking the tree item
   * (exercises the real handleFileOpenFromTree flow, unlike openFileInWorkspace).
   */
  async openFileFromTree(fileName: string): Promise<void> {
    await this.page.click(`.file-tree-item:has-text("${fileName}")`)
    await this.page.waitForTimeout(150)
  }

  /**
   * Whether a workspace's rail item is dimmed (browse-only / not in editor).
   */
  async isRailItemDimmed(workspaceName: string): Promise<boolean> {
    return this.page.evaluate((name) => {
      const items = Array.from(document.querySelectorAll('.workspace-bar-item'))
      const item = items.find((el) => el.textContent?.includes(name))
      return item ? item.classList.contains('not-in-editor') : false
    }, workspaceName)
  }

  /**
   * Get the active workspace ID from Redux state
   */
  async getActiveWorkspaceId(): Promise<string | null> {
    return this.page.evaluate(() => {
      const store = (window as unknown as { __REDUX_STORE__?: { getState: () => { workspaces: { activeWorkspaceId: string } } } }).__REDUX_STORE__
      return store?.getState().workspaces.activeWorkspaceId || null
    })
  }

  /**
   * Get visibility state for all workspaces
   */
  async getWorkspaceVisibility(): Promise<Record<string, boolean>> {
    return this.page.evaluate(() => {
      const store = (window as unknown as { __REDUX_STORE__?: { getState: () => { workspaces: { workspaces: Array<{ id: string; visibleInTabBar: boolean }> } } } }).__REDUX_STORE__
      const workspaces = store?.getState().workspaces.workspaces || []
      const visibility: Record<string, boolean> = {}
      workspaces.forEach((ws: { id: string; visibleInTabBar: boolean }) => {
        visibility[ws.id] = ws.visibleInTabBar
      })
      return visibility
    })
  }

  /**
   * Check if a workspace's tab group has a horizontal scrollbar
   */
  async hasHorizontalScrollbar(workspaceId: string): Promise<boolean> {
    return this.page.evaluate((wsId) => {
      const group = document.querySelector(`.tab-group[data-workspace-id="${wsId}"]`)
      if (!group) return false
      const scrollable = group.querySelector('.tab-group-scrollable')
      if (!scrollable) return false
      return scrollable.scrollWidth > scrollable.clientWidth
    }, workspaceId)
  }

  /**
   * Get scroll position of a workspace's tab group
   */
  async getScrollPosition(workspaceId: string): Promise<number> {
    return this.page.evaluate((wsId) => {
      const group = document.querySelector(`.tab-group[data-workspace-id="${wsId}"]`)
      if (!group) return 0
      const scrollable = group.querySelector('.tab-group-scrollable')
      return scrollable ? scrollable.scrollLeft : 0
    }, workspaceId)
  }

  /**
   * Scroll a workspace's tab group
   */
  async scrollTabGroup(workspaceId: string, amount: number): Promise<void> {
    await this.page.evaluate(({ wsId, scrollAmount }) => {
      const group = document.querySelector(`.tab-group[data-workspace-id="${wsId}"]`)
      if (!group) return
      const scrollable = group.querySelector('.tab-group-scrollable')
      if (scrollable) {
        scrollable.scrollLeft += scrollAmount
      }
    }, { wsId: workspaceId, scrollAmount: amount })
    await this.page.waitForTimeout(100)
  }

  /**
   * Check if overflow indicator is visible
   */
  async isOverflowIndicatorVisible(): Promise<boolean> {
    return this.page.evaluate(() => {
      const overflow = document.querySelector('.tab-bar-overflow')
      if (!overflow) return false
      // Check if it has any workspaces to show
      return overflow.querySelector('.overflow-button') !== null ||
             overflow.textContent?.includes('+') || false
    })
  }

  /**
   * Get the overflow count from the indicator
   */
  async getOverflowCount(): Promise<number> {
    return this.page.evaluate(() => {
      const overflow = document.querySelector('.tab-bar-overflow .overflow-button')
      if (!overflow) return 0
      const text = overflow.textContent || ''
      const match = text.match(/\+(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    })
  }

  /**
   * Clean up test workspace folders
   */
  async cleanup(): Promise<void> {
    const tempDir = path.join(__dirname, '../../test-temp')
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }

  /**
   * Expose Redux store for testing (call once after app ready)
   */
  async exposeReduxStore(): Promise<void> {
    await this.page.evaluate(() => {
      // This relies on store being available globally during development
      // In production, we'd need a different approach
      const root = document.getElementById('root')
      if (root) {
        const reactRoot = (root as unknown as { _reactRootContainer?: { _internalRoot?: { current?: { memoizedState?: { element?: { props?: { store?: unknown } } } } } } })._reactRootContainer
        const store = reactRoot?._internalRoot?.current?.memoizedState?.element?.props?.store
        if (store) {
          (window as unknown as { __REDUX_STORE__: unknown }).__REDUX_STORE__ = store
        }
      }
    })
  }
}
