import { Page } from '@playwright/test'

/**
 * Helpers for interacting with the tabs Redux slice via the window-exposed store
 * in e2e tests. Used by specs/tabs/ e2e tests.
 */

export interface TabSnapshot {
  id: string
  workspaceId: string
  filename: string
  content: string
  isDirty: boolean
  path?: string
  cursorPosition?: { lineNumber: number; column: number }
  scrollTop?: number
}

/**
 * Dispatch a generic Redux action against the exposed store.
 */
export async function dispatchAction(page: Page, type: string, payload: unknown): Promise<void> {
  await page.evaluate(
    ({ t, p }) => {
      const store = (window as unknown as {
        __REDUX_STORE__?: { dispatch: (a: unknown) => void }
      }).__REDUX_STORE__
      if (!store) throw new Error('Redux store not exposed on window')
      store.dispatch({ type: t, payload: p })
    },
    { t: type, p: payload }
  )
}

/**
 * Read the full tabs slice state.
 */
export async function getTabsState(
  page: Page
): Promise<{ tabs: TabSnapshot[]; activeTabIdByWorkspace: Record<string, string | null> }> {
  return page.evaluate(() => {
    const store = (window as unknown as {
      __REDUX_STORE__?: {
        getState: () => {
          tabs: {
            tabs: TabSnapshot[]
            activeTabIdByWorkspace: Record<string, string | null>
          }
        }
      }
    }).__REDUX_STORE__
    if (!store) throw new Error('Redux store not exposed on window')
    const s = store.getState()
    return {
      tabs: s.tabs.tabs,
      activeTabIdByWorkspace: s.tabs.activeTabIdByWorkspace
    }
  })
}

/**
 * Add a tab by dispatching `tabs/addTab`.
 */
export async function addTab(
  page: Page,
  tab: Partial<TabSnapshot> & { id: string; workspaceId: string; filename: string }
): Promise<void> {
  const payload: TabSnapshot = {
    content: '',
    isDirty: false,
    ...tab
  } as TabSnapshot
  await dispatchAction(page, 'tabs/addTab', payload)
}

/**
 * Ensure a workspace-active-tab entry exists so the slice can track it.
 */
export async function initWorkspace(page: Page, workspaceId: string): Promise<void> {
  await dispatchAction(page, 'tabs/initWorkspaceActiveTab', workspaceId)
}

/**
 * Add a workspace to the workspaces slice so the TabBar can render its group.
 */
export async function addWorkspace(
  page: Page,
  ws: { id: string; name: string; color?: string }
): Promise<void> {
  await dispatchAction(page, 'workspaces/addWorkspace', {
    id: ws.id,
    name: ws.name,
    color: ws.color ?? '#4daafc',
    rootPath: null,
    isExpanded: true,
    showHiddenFiles: false,
    visibleInTabBar: true
  })
}

/**
 * Close all existing tabs (for test isolation) by iterating over the global
 * workspace id set and dispatching closeTabsByWorkspace for each.
 */
export async function resetTabs(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as unknown as {
      __REDUX_STORE__?: {
        getState: () => {
          tabs: { tabs: Array<{ workspaceId: string }> }
        }
        dispatch: (a: unknown) => void
      }
    }).__REDUX_STORE__
    if (!store) return
    const seen = new Set<string>()
    store.getState().tabs.tabs.forEach((t) => seen.add(t.workspaceId))
    seen.forEach((wsId) => {
      store.dispatch({ type: 'tabs/closeTabsByWorkspace', payload: wsId })
    })
  })
}

/**
 * Read visible tab DOM info within a given workspace group.
 */
export async function getDomTabs(
  page: Page,
  workspaceId: string
): Promise<Array<{ label: string; isActive: boolean; isDirty: boolean }>> {
  return page.evaluate((wsId) => {
    const group = document.querySelector(`.tab-group[data-workspace-id="${wsId}"]`)
    if (!group) return []
    const tabs = group.querySelectorAll('.tab')
    return Array.from(tabs).map((t) => ({
      label: (t.querySelector('.tab-label')?.textContent || '').replace(/●$/, '').trim(),
      isActive: t.classList.contains('active'),
      isDirty: !!t.querySelector('.dirty-indicator')
    }))
  }, workspaceId)
}
