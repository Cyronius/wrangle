import { FileTreeNode } from '../../../../shared/workspace-types'
import './workspace.css'

interface FileTreeItemProps {
  node: FileTreeNode
  depth: number
  isExpanded: boolean
  isSelected: boolean
  onToggle: () => void
  onSelect: () => void
}

// Chevron icon for expand/collapse
function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// Folder icon
function FolderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
    </svg>
  )
}

// Folder open icon
function FolderOpenIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
    </svg>
  )
}

// File icon
function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

// Markdown file icon
function MarkdownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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

export function FileTreeItem({
  node,
  depth,
  isExpanded,
  isSelected,
  onToggle,
  onSelect
}: FileTreeItemProps) {
  const indentWidth = 16 * depth + 8 // 16px per level + 8px base padding

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.isDirectory) {
      onToggle()
    } else {
      onSelect()
    }
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (node.isDirectory) {
      onToggle()
    } else {
      onSelect()
    }
  }

  const getFileIconClass = () => {
    if (node.isDirectory) return 'folder'
    if (isMarkdownFile(node.name)) return 'markdown'
    return 'file'
  }

  return (
    <div
      className={`file-tree-item ${node.isDirectory ? 'directory' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      role="treeitem"
      aria-expanded={node.isDirectory ? isExpanded : undefined}
      aria-selected={isSelected}
      tabIndex={-1}
    >
      <div className="file-tree-indent" style={{ width: indentWidth }} />

      {node.isDirectory ? (
        <div className={`file-tree-expand ${isExpanded ? 'expanded' : ''}`}>
          <ChevronIcon />
        </div>
      ) : (
        <div className="file-tree-expand" />
      )}

      <div className={`file-tree-icon ${getFileIconClass()}`}>
        {node.isDirectory ? (
          isExpanded ? <FolderOpenIcon /> : <FolderIcon />
        ) : isMarkdownFile(node.name) ? (
          <MarkdownIcon />
        ) : (
          <FileIcon />
        )}
      </div>

      <span className="file-tree-name">{node.name}</span>
    </div>
  )
}
