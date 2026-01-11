import { useEffect, useRef, useState } from 'react'
import * as monaco from 'monaco-editor'

interface UseImageDropProps {
  editorRef?: React.RefObject<monaco.editor.IStandaloneCodeEditor>
  tabId?: string
  currentFilePath?: string
  onImageInsert?: (imagePath: string) => void
}

export function useImageDrop({ editorRef, tabId, currentFilePath, onImageInsert }: UseImageDropProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

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

      // Check if we have a tab ID (required for temp directory)
      if (!tabId) {
        console.warn('No active tab ID for image drop')
        return
      }

      const imageFiles = Array.from(files).filter((file) =>
        /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(file.name)
      )

      if (imageFiles.length === 0) {
        return
      }

      // Process each image
      for (const file of imageFiles) {
        try {
          // Get the file path
          const filePath = (file as any).path

          if (!filePath) {
            console.warn('Could not get file path for', file.name)
            continue
          }

          // Call IPC to copy image to assets folder
          // Pass null for currentFilePath if file is not saved (will use temp directory)
          const relativePath = await window.electron.file.copyImage(
            filePath,
            tabId,
            currentFilePath || null
          )

          if (relativePath) {
            // Insert markdown image syntax at cursor
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
          alert(`Failed to add image: ${file.name}`)
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
  }, [editorRef, tabId, currentFilePath, onImageInsert])

  return { isDragging }
}
