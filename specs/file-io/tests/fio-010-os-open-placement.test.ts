// Traces: FIO-010 (canonical spec: specs/file-io/spec.md)
//
// Property under test: findFolderWorkspaceForPath returns the open folder-backed
// workspace that contains a file path (ancestor containment), or null when no
// open folder workspace owns it — in which case OS-opened files fall back to the
// default workspace. This is the placement rule for files opened via the OS
// (file:openFromPath); the default-vs-owning-folder decision is what FIO-010
// specifies.
//
// The focus/visibility wiring (switching the active workspace, activating the
// tab, focusing Monaco) is React/Electron UI behavior and is verified manually —
// see the describe.skip block at the bottom.

import { describe, it, expect } from 'vitest'
import {
  findFolderWorkspaceForPath,
  selectWorkspaceForPath
} from '../../../src/renderer/src/store/workspacesSlice'
import { DEFAULT_WORKSPACE_ID } from '../../../src/shared/workspace-types'
import type { WorkspaceState } from '../../../src/shared/workspace-types'

function ws(id: string, rootPath: string | null): WorkspaceState {
  return {
    id,
    name: id,
    color: '#000000',
    rootPath,
    isExpanded: true,
    showHiddenFiles: true
  }
}

const defaultWs = ws(DEFAULT_WORKSPACE_ID, null)

describe('FIO-010: findFolderWorkspaceForPath', () => {
  it('returns the folder workspace whose rootPath directly contains the file', () => {
    const projects = ws('projects', 'C:/Users/me/projects')
    const found = findFolderWorkspaceForPath([defaultWs, projects], 'C:/Users/me/projects/note.md')
    expect(found?.id).toBe('projects')
  })

  it('matches files in a nested subfolder of a folder workspace', () => {
    const projects = ws('projects', 'C:/Users/me/projects')
    const found = findFolderWorkspaceForPath(
      [defaultWs, projects],
      'C:/Users/me/projects/docs/sub/deep.md'
    )
    expect(found?.id).toBe('projects')
  })

  it('returns null when no folder workspace contains the file (caller uses default)', () => {
    const projects = ws('projects', 'C:/Users/me/projects')
    const found = findFolderWorkspaceForPath([defaultWs, projects], 'D:/somewhere/else/x.md')
    expect(found).toBeNull()
  })

  it('returns null when only the default workspace is open', () => {
    expect(findFolderWorkspaceForPath([defaultWs], 'C:/anything/x.md')).toBeNull()
  })

  it('normalizes Windows backslash paths against forward-slash rootPaths and vice versa', () => {
    const projects = ws('projects', 'C:\\Users\\me\\projects')
    const found = findFolderWorkspaceForPath([defaultWs, projects], 'C:/Users/me/projects/note.md')
    expect(found?.id).toBe('projects')
  })

  it('does not match a sibling folder sharing a path prefix', () => {
    // "projects-archive" must not be matched by a "projects" rootPath.
    const projects = ws('projects', 'C:/Users/me/projects')
    const found = findFolderWorkspaceForPath(
      [defaultWs, projects],
      'C:/Users/me/projects-archive/old.md'
    )
    expect(found).toBeNull()
  })

  it('first matching workspace wins for nested folder workspaces', () => {
    const outer = ws('outer', 'C:/Users/me/projects')
    const inner = ws('inner', 'C:/Users/me/projects/inner')
    // Order in the array determines precedence; outer comes first here.
    const found = findFolderWorkspaceForPath(
      [defaultWs, outer, inner],
      'C:/Users/me/projects/inner/note.md'
    )
    expect(found?.id).toBe('outer')
  })

  it('undefined path returns null', () => {
    expect(findFolderWorkspaceForPath([defaultWs], undefined)).toBeNull()
  })
})

describe('FIO-010: selectWorkspaceForPath parity after refactor', () => {
  const makeState = (workspaces: WorkspaceState[]) =>
    ({ workspaces: { workspaces, activeWorkspaceId: DEFAULT_WORKSPACE_ID } } as never)

  it('falls back to the default workspace when no folder workspace owns the file', () => {
    const projects = ws('projects', 'C:/Users/me/projects')
    const selected = selectWorkspaceForPath(makeState([defaultWs, projects]), 'D:/elsewhere/x.md')
    expect(selected.id).toBe(DEFAULT_WORKSPACE_ID)
  })

  it('returns the owning folder workspace when one contains the file', () => {
    const projects = ws('projects', 'C:/Users/me/projects')
    const selected = selectWorkspaceForPath(
      makeState([defaultWs, projects]),
      'C:/Users/me/projects/note.md'
    )
    expect(selected.id).toBe('projects')
  })
})

// Verification: manual
// FIO-010 focus/visibility wiring (renderer + Electron; not unit-testable).
// 1. Open the default workspace and a folder workspace. From Explorer, open a
//    .md OUTSIDE the folder → a tab appears in Default, Default becomes the
//    active/visible workspace, and the editor has keyboard focus.
// 2. From Explorer, open a .md INSIDE the open folder workspace → the tab opens
//    in that workspace, which becomes active/focused with the editor focused.
// 3. Open (from Explorer) a file already open in a background workspace → that
//    workspace is surfaced and its existing tab activated; no duplicate tab is
//    created.
describe.skip('FIO-010: focus/visibility manual verification', () => {
  it.todo('see verification procedure above')
})
