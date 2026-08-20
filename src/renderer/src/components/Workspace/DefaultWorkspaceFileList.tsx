import { useSelector, useDispatch } from 'react-redux'
import { createSelector } from '@reduxjs/toolkit'
import { RootState, AppDispatch } from '../../store/store'
import { setActiveTab } from '../../store/tabsSlice'
import { setActiveWorkspace } from '../../store/workspacesSlice'
import { DEFAULT_WORKSPACE_ID } from '../../../../shared/workspace-types'
import './workspace.css'

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function MarkdownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 15l2-2 2 2" />
      <line x1="11" y1="13" x2="11" y2="17" />
    </svg>
  )
}

function isMarkdownFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdx')
}

function directoryOf(filePath: string): string {
  const sep = filePath.includes('\\') ? '\\' : '/'
  const lastSep = filePath.lastIndexOf(sep)
  return lastSep > 0 ? filePath.substring(0, lastSep) : filePath
}

const selectDefaultWorkspaceTabs = createSelector(
  (state: RootState) => state.tabs.tabs,
  (tabs) => tabs.filter(t => t.workspaceId === DEFAULT_WORKSPACE_ID)
)

export function DefaultWorkspaceFileList() {
  const dispatch = useDispatch<AppDispatch>()
  const tabs = useSelector(selectDefaultWorkspaceTabs)
  const activeTabId = useSelector((state: RootState) => state.tabs.activeTabIdByWorkspace[DEFAULT_WORKSPACE_ID] ?? null)

  if (tabs.length === 0) {
    return <div className="file-tree file-tree-empty">Open files will appear here</div>
  }

  return (
    <div className="file-tree" role="list" aria-label="Open files">
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId
        const hasPath = !!tab.path
        const displayName = hasPath ? tab.filename : (tab.displayTitle || tab.filename)
        const displayPath = hasPath ? directoryOf(tab.path!) : 'Unsaved'

        return (
          <div
            key={tab.id}
            className={`file-tree-item ${isActive ? 'selected' : ''}`}
            onClick={() => {
              // SBR-003: activate both the tab and the default workspace so
              // the tab bar swaps to the loose files (WTB-014)
              dispatch(setActiveWorkspace(DEFAULT_WORKSPACE_ID))
              dispatch(setActiveTab(tab.id))
            }}
            role="listitem"
            aria-selected={isActive}
          >
            <div className="file-tree-expand" />
            <div className={`file-tree-icon ${isMarkdownFile(tab.filename) ? 'markdown' : 'file'}`}>
              {isMarkdownFile(tab.filename) ? <MarkdownIcon /> : <FileIcon />}
            </div>
            <div className="default-ws-file-info">
              <span className="file-tree-name">
                {displayName}
                {tab.isDirty && <span className="default-ws-dirty-dot"> ●</span>}
              </span>
              <span className="default-ws-file-path" title={tab.path}>{displayPath}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
