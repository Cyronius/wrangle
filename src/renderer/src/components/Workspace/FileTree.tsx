import { useState, useEffect, useCallback, useRef } from 'react'
import { FileTreeNode } from '../../../../shared/workspace-types'
import { FileTreeItem } from './FileTreeItem'
import './workspace.css'

const MARKDOWN_EXTENSIONS = /\.(md|markdown|mdown|mkd|mdwn)$/i

interface FileTreeProps {
  rootPath: string
  workspaceId: string
  onFileOpen: (filePath: string) => void
  selectedPath?: string
  showHiddenFiles?: boolean
  onFilesAdded?: () => void
}

export function FileTree({ rootPath, workspaceId, onFileOpen, selectedPath, showHiddenFiles, onFilesAdded }: FileTreeProps) {
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([rootPath]))
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Drop handling state
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const dragCounterRef = useRef(0)

  // Load initial file tree
  useEffect(() => {
    let cancelled = false

    const loadTree = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Load with depth 3 for initial view
        const tree = await window.electron.workspace.listFilesRecursive(rootPath, 3, showHiddenFiles)
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
  }, [rootPath, workspaceId, showHiddenFiles])

  // Refresh file tree function
  const refreshTree = useCallback(async () => {
    try {
      const tree = await window.electron.workspace.listFilesRecursive(rootPath, 3, showHiddenFiles)
      setFileTree(tree)
    } catch (err) {
      console.error('FileTree refresh error:', err)
    }
  }, [rootPath, showHiddenFiles])

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

  // Drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++

    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--

    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    dragCounterRef.current = 0

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    const copiedPaths: string[] = []
    const markdownPaths: string[] = []

    for (const file of Array.from(files)) {
      const filePath = (file as any).path
      if (!filePath) continue

      try {
        // Check if file is already inside workspace
        const isInside = await window.electron.workspace.isPathInWorkspace(
          filePath,
          rootPath
        )

        if (isInside) {
          // File already in workspace, no copy needed
          if (MARKDOWN_EXTENSIONS.test(file.name)) {
            markdownPaths.push(filePath)
          }
          continue
        }

        // Copy to workspace root
        const targetPath = await window.electron.file.copyToWorkspace(
          filePath,
          rootPath
        )

        if (targetPath) {
          copiedPaths.push(targetPath)
          if (MARKDOWN_EXTENSIONS.test(file.name)) {
            markdownPaths.push(targetPath)
          }
        }
      } catch (error) {
        console.error('Error copying file to workspace:', error)
      }
    }

    // Refresh file tree if files were copied
    if (copiedPaths.length > 0) {
      await refreshTree()
      onFilesAdded?.()
    }

    // Open markdown files that were dropped
    for (const path of markdownPaths) {
      onFileOpen(path)
    }
  }, [rootPath, refreshTree, onFilesAdded, onFileOpen])

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
    return (
      <div
        className={`file-tree file-tree-empty ${isDraggingOver ? 'drop-target' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDraggingOver ? 'Drop files here' : 'No files in workspace'}
      </div>
    )
  }

  return (
    <div
      className={`file-tree ${isDraggingOver ? 'drop-target' : ''}`}
      role="tree"
      aria-label="File explorer"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDraggingOver && (
        <div className="file-tree-drop-indicator">
          Drop files to copy to workspace
        </div>
      )}
      {fileTree.map((node) => renderNode(node, 0))}
    </div>
  )
}
