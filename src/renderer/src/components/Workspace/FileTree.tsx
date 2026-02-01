import { useState, useEffect, useCallback } from 'react'
import { FileTreeNode } from '../../../../shared/workspace-types'
import { FileTreeItem } from './FileTreeItem'
import './workspace.css'

interface FileTreeProps {
  rootPath: string
  workspaceId: string
  onFileOpen: (filePath: string) => void
  selectedPath?: string
}

export function FileTree({ rootPath, workspaceId, onFileOpen, selectedPath }: FileTreeProps) {
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([rootPath]))
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load initial file tree
  useEffect(() => {
    let cancelled = false

    const loadTree = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Load with depth 3 for initial view
        const tree = await window.electron.workspace.listFilesRecursive(rootPath, 3)
        if (!cancelled) {
          setFileTree(tree)
          setIsLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load files')
          setIsLoading(false)
          console.error('FileTree load error:', err)
        }
      }
    }

    loadTree()

    return () => {
      cancelled = true
    }
  }, [rootPath, workspaceId])

  // Handle folder expand/collapse
  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  // Handle file selection
  const handleSelect = useCallback(
    (path: string) => {
      onFileOpen(path)
    },
    [onFileOpen]
  )

  // Recursive render function
  const renderNode = (node: FileTreeNode, depth: number) => {
    const isExpanded = expandedPaths.has(node.path)
    const isSelected = selectedPath === node.path

    return (
      <div key={node.path}>
        <FileTreeItem
          node={node}
          depth={depth}
          isExpanded={isExpanded}
          isSelected={isSelected}
          onToggle={() => handleToggle(node.path)}
          onSelect={() => handleSelect(node.path)}
        />
        {node.isDirectory && isExpanded && node.children && (
          <div role="group">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return <div className="file-tree-loading">Loading files...</div>
  }

  if (error) {
    return <div className="file-tree-error">{error}</div>
  }

  if (fileTree.length === 0) {
    return <div className="file-tree-empty">No files in workspace</div>
  }

  return (
    <div className="file-tree" role="tree" aria-label="File explorer">
      {fileTree.map((node) => renderNode(node, 0))}
    </div>
  )
}
