import { useState, useEffect, useCallback, useRef } from 'react'
import { FileTreeNode } from '../../../../shared/workspace-types'
import { FileTreeItem } from './FileTreeItem'
import { isTextFile } from '../../../../shared/file-extensions'
import './workspace.css'

interface FileTreeProps {
  rootPath: string
  workspaceId: string
  onFileOpen: (filePath: string) => void
  selectedPath?: string
  showHiddenFiles?: boolean
  onFilesAdded?: () => void
  openPaths?: Set<string>
}

export function FileTree({ rootPath, workspaceId, onFileOpen, selectedPath, showHiddenFiles, onFilesAdded, openPaths }: FileTreeProps) {
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([rootPath]))
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Multi-selection state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [anchorPath, setAnchorPath] = useState<string | null>(null)

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

  // Clear multi-selection when tree refreshes
  useEffect(() => {
    setSelectedPaths(new Set())
    setAnchorPath(null)
  }, [fileTree])

  // Flatten visible file paths (files only, respecting expanded folders)
  const flattenVisibleFiles = useCallback((nodes: FileTreeNode[]): string[] => {
    const result: string[] = []
    for (const node of nodes) {
      if (!node.isDirectory) {
        result.push(node.path)
      }
      if (node.isDirectory && expandedPaths.has(node.path) && node.children) {
        result.push(...flattenVisibleFiles(node.children))
      }
    }
    return result
  }, [expandedPaths])

  // Handle file selection with modifier key support
  // Ctrl/Shift clicks only select visually (for future context menu actions).
  // Plain click opens the file.
  const handleSelect = useCallback(
    (path: string, e: React.MouseEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey
      const isShift = e.shiftKey

      if (isShift && anchorPath) {
        // Range select from anchor to clicked path
        const flatPaths = flattenVisibleFiles(fileTree)
        const anchorIdx = flatPaths.indexOf(anchorPath)
        const targetIdx = flatPaths.indexOf(path)

        if (anchorIdx !== -1 && targetIdx !== -1) {
          const [start, end] = anchorIdx <= targetIdx
            ? [anchorIdx, targetIdx]
            : [targetIdx, anchorIdx]
          setSelectedPaths(new Set(flatPaths.slice(start, end + 1)))
        }
      } else if (isCtrlOrMeta) {
        // Toggle single path in selection
        setSelectedPaths(prev => {
          const next = new Set(prev)
          if (next.has(path)) {
            next.delete(path)
          } else {
            next.add(path)
          }
          return next
        })
        setAnchorPath(path)
      } else {
        // Plain click: clear selection, open single file
        setSelectedPaths(new Set())
        setAnchorPath(path)
        onFileOpen(path)
      }
    },
    [onFileOpen, anchorPath, flattenVisibleFiles, fileTree]
  )

  // Open all multi-selected files on Enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && selectedPaths.size > 0) {
      e.preventDefault()
      for (const p of selectedPaths) {
        onFileOpen(p)
      }
      setSelectedPaths(new Set())
    }
  }, [selectedPaths, onFileOpen])

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
    const textFilePaths: string[] = []

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
          if (isTextFile(file.name)) {
            textFilePaths.push(filePath)
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
          if (isTextFile(file.name)) {
            textFilePaths.push(targetPath)
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

    // Open text files that were dropped
    for (const path of textFilePaths) {
      onFileOpen(path)
    }
  }, [rootPath, refreshTree, onFilesAdded, onFileOpen])

  // Recursive render function
  const renderNode = (node: FileTreeNode, depth: number) => {
    const isExpanded = expandedPaths.has(node.path)
    const isSelected = selectedPath === node.path
    const isOpen = !node.isDirectory && (openPaths?.has(node.path) ?? false)
    const isMultiSelected = selectedPaths.has(node.path)

    return (
      <div key={node.path}>
        <FileTreeItem
          node={node}
          depth={depth}
          isExpanded={isExpanded}
          isSelected={isSelected}
          isOpen={isOpen}
          isMultiSelected={isMultiSelected}
          onToggle={() => handleToggle(node.path)}
          onSelect={(e: React.MouseEvent) => handleSelect(node.path, e)}
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
      tabIndex={0}
      onKeyDown={handleKeyDown}
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
