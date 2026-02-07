import { useEffect, useRef, useState, useCallback } from 'react'
import * as monaco from 'monaco-editor'
import { WorkspaceState } from '../../../shared/workspace-types'
import { Tab } from '../store/tabsSlice'

interface MarkdownFileData {
  path: string
  content: string
  workspaceId: string
}

interface UseImageDropProps {
  editorRef?: React.RefObject<monaco.editor.IStandaloneCodeEditor>
  tabId?: string
  currentFilePath?: string
  onImageInsert?: (imagePath: string) => void
  // Props for markdown file handling
  workspaces?: WorkspaceState[]
  activeWorkspaceId?: string
  tabs?: Tab[]
  onMarkdownFilesOpen?: (files: MarkdownFileData[]) => void
}

const MARKDOWN_EXTENSIONS = /\.(md|markdown|mdown|mkd|mdwn)$/i
const IMAGE_EXTENSIONS = /\.(png|jpg|jpeg|gif|svg|webp)$/i

export function useImageDrop({
  editorRef,
  tabId,
  currentFilePath,
  onImageInsert,
  workspaces,
  activeWorkspaceId,
  tabs,
  onMarkdownFilesOpen
}: UseImageDropProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  // Find workspace for a given file path
  const detectWorkspaceForPath = useCallback((filePath: string): string => {
    if (!workspaces || !activeWorkspaceId) return activeWorkspaceId || '__default__'

    const normalizedFilePath = filePath.replace(/\\/g, '/')
    for (const workspace of workspaces) {
      if (workspace.rootPath) {
        const normalizedRootPath = workspace.rootPath.replace(/\\/g, '/')
        if (normalizedFilePath.startsWith(normalizedRootPath + '/')) {
          return workspace.id
        }
      }
    }
    return activeWorkspaceId
  }, [workspaces, activeWorkspaceId])

  // Get the expanded folder workspace (if any)
  const getExpandedFolderWorkspace = useCallback((): WorkspaceState | undefined => {
    if (!workspaces) return undefined
    return workspaces.find(w => w.isExpanded && w.rootPath)
  }, [workspaces])

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current++
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true)
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current--
      if (dragCounterRef.current === 0) {
        setIsDragging(false)
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      dragCounterRef.current = 0

      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return

      // Separate files by type
      const imageFiles = Array.from(files).filter((file) =>
        IMAGE_EXTENSIONS.test(file.name)
      )
      const markdownFiles = Array.from(files).filter((file) =>
        MARKDOWN_EXTENSIONS.test(file.name)
      )

      // Process image files (existing behavior)
      if (imageFiles.length > 0 && tabId) {
        for (const file of imageFiles) {
          try {
            const filePath = (file as any).path
            if (!filePath) {
              console.warn('Could not get file path for', file.name)
              continue
            }

            const relativePath = await window.electron.file.copyImage(
              filePath,
              tabId,
              currentFilePath || null
            )

            if (relativePath) {
              const imageMarkdown = `![${file.name}](${relativePath})`

              if (editorRef?.current) {
                const editor = editorRef.current
                const selection = editor.getSelection()

                if (selection) {
                  editor.executeEdits('', [
                    {
                      range: selection,
                      text: imageMarkdown + '\n'
                    }
                  ])
                }
              }

              if (onImageInsert) {
                onImageInsert(relativePath)
              }
            }
          } catch (error) {
            console.error('Error processing image:', error)
          }
        }
      }

      // Process markdown files
      if (markdownFiles.length > 0 && onMarkdownFilesOpen) {
        const expandedWorkspace = getExpandedFolderWorkspace()
        const filesToOpen: MarkdownFileData[] = []

        for (const file of markdownFiles) {
          try {
            let filePath = (file as any).path
            if (!filePath) {
              console.warn('Could not get file path for', file.name)
              continue
            }

            // Check if file is already open
            if (tabs?.find(t => t.path === filePath)) {
              continue
            }

            let workspaceId = detectWorkspaceForPath(filePath)
            let targetPath = filePath

            // If we have an expanded folder workspace, check if file needs copying
            if (expandedWorkspace && expandedWorkspace.rootPath) {
              const isInside = await window.electron.workspace.isPathInWorkspace(
                filePath,
                expandedWorkspace.rootPath
              )

              if (!isInside) {
                // Copy file to workspace root
                const newPath = await window.electron.file.copyToWorkspace(
                  filePath,
                  expandedWorkspace.rootPath
                )
                if (newPath) {
                  targetPath = newPath
                  workspaceId = expandedWorkspace.id
                }
              }
            }

            // Read file content
            const fileData = await window.electron.file.readByPath(targetPath)
            if (!fileData || 'error' in fileData) {
              console.error('Could not read file:', targetPath)
              continue
            }

            filesToOpen.push({
              path: targetPath,
              content: fileData.content,
              workspaceId
            })
          } catch (error) {
            console.error('Error processing markdown file:', error)
          }
        }

        // Open all files at once
        if (filesToOpen.length > 0) {
          onMarkdownFilesOpen(filesToOpen)
        }
      }
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [
    editorRef,
    tabId,
    currentFilePath,
    onImageInsert,
    tabs,
    onMarkdownFilesOpen,
    detectWorkspaceForPath,
    getExpandedFolderWorkspace
  ])

  return { isDragging }
}
