import { ipcMain, dialog } from 'electron'
import { readFile, writeFile, copyFile, mkdir, open } from 'fs/promises'
import { FileData } from '../../shared/types'
import * as path from 'path'
import { existsSync } from 'fs'
import {
  getTempDir,
  getTempAssetDir,
  getTempDraftPath,
  ensureTempDir,
  ensureTempAssetDir,
  moveTempToSaved,
  cleanupTempDir
} from '../utils/temp-dir-manager'

// Extensions known to be text files
const TEXT_EXTENSIONS = new Set([
  '.md', '.markdown', '.mdown', '.mkd', '.mdwn',
  '.txt', '.text',
  '.json', '.jsonc', '.json5',
  '.yaml', '.yml',
  '.toml', '.ini', '.cfg', '.conf',
  '.xml', '.svg', '.html', '.htm', '.xhtml',
  '.css', '.scss', '.sass', '.less',
  '.js', '.mjs', '.cjs', '.jsx',
  '.ts', '.mts', '.cts', '.tsx',
  '.py', '.pyw', '.pyi',
  '.rb', '.rake',
  '.sh', '.bash', '.zsh', '.fish',
  '.bat', '.cmd', '.ps1',
  '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx',
  '.java', '.kt', '.kts', '.scala',
  '.go', '.rs', '.swift',
  '.lua', '.r', '.R', '.jl',
  '.sql', '.graphql', '.gql',
  '.env', '.gitignore', '.gitattributes', '.editorconfig',
  '.log', '.csv', '.tsv',
  '.tex', '.bib', '.sty',
  '.dockerfile', '.makefile',
  '.vim', '.el', '.clj', '.cljs',
  '.dart', '.zig', '.nim', '.v',
  '.astro', '.vue', '.svelte',
  '.diff', '.patch',
  '.properties', '.gradle',
  '.lock', '.sum'
])

// Check if a file is likely binary by scanning first 8KB for null bytes
async function isBinaryFile(filePath: string): Promise<boolean> {
  const ext = path.extname(filePath).toLowerCase()

  // Known text extensions - always treat as text
  if (TEXT_EXTENSIONS.has(ext)) return false

  // No extension - check content
  // Also check content for unknown extensions
  try {
    const fd = await open(filePath, 'r')
    try {
      const buffer = Buffer.alloc(8192)
      const { bytesRead } = await fd.read(buffer, 0, 8192, 0)

      // Check for null bytes in the first 8KB
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) return true
      }
      return false
    } finally {
      await fd.close()
    }
  } catch {
    return false
  }
}

export function registerFileHandlers(): void {
  // Handle file open (supports multiple selection)
  ipcMain.handle('file:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdown', 'mkd', 'mdwn'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return []
    }

    const files: FileData[] = []
    for (const filePath of result.filePaths) {
      try {
        const content = await readFile(filePath, 'utf-8')
        files.push({ path: filePath, content })
      } catch (error) {
        console.error('Error reading file:', filePath, error)
        // Continue with other files
      }
    }
    return files
  })

  // Handle reading a file by path (for workspace file tree)
  ipcMain.handle('file:readByPath', async (_event, filePath: string) => {
    try {
      // Check if file is binary
      if (await isBinaryFile(filePath)) {
        return { error: 'binary' }
      }

      const content = await readFile(filePath, 'utf-8')
      return {
        path: filePath,
        content
      } as FileData
    } catch (error) {
      console.error('Error reading file by path:', error)
      return null
    }
  })

  // Handle file save
  ipcMain.handle('file:save', async (_event, path: string, content: string) => {
    try {
      await writeFile(path, content, 'utf-8')
      return true
    } catch (error) {
      console.error('Error saving file:', error)
      dialog.showErrorBox('File Save Error', `Could not save file: ${error}`)
      return false
    }
  })

  // Handle file save as
  ipcMain.handle('file:saveAs', async (_event, content: string, suggestedName?: string) => {
    // Use suggested name if provided, otherwise default to 'untitled'
    const defaultName = suggestedName ? `${suggestedName}.md` : 'untitled.md'
    const result = await dialog.showSaveDialog({
      filters: [
        { name: 'Markdown Files', extensions: ['md'] },
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      defaultPath: defaultName
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    try {
      await writeFile(result.filePath, content, 'utf-8')
      return result.filePath
    } catch (error) {
      console.error('Error saving file:', error)
      dialog.showErrorBox('File Save Error', `Could not save file: ${error}`)
      return null
    }
  })

  // Handle image copy for drag & drop
  ipcMain.handle(
    'file:copyImage',
    async (_event, sourcePath: string, tabId: string, markdownFilePath: string | null) => {
      try {
        let assetsDir: string

        if (markdownFilePath) {
          // If file is saved, use the directory of the markdown file
          const markdownDir = path.dirname(markdownFilePath)
          assetsDir = path.join(markdownDir, 'assets')

          // Create assets directory if it doesn't exist
          if (!existsSync(assetsDir)) {
            await mkdir(assetsDir, { recursive: true })
          }
        } else {
          // If file is not saved, use temp assets directory
          await ensureTempAssetDir(tabId)
          assetsDir = getTempAssetDir(tabId)
        }

        // Get the image filename
        const imageExt = path.extname(sourcePath)
        let imageBasename = path.basename(sourcePath, imageExt)

        // Sanitize filename
        imageBasename = imageBasename.replace(/[^a-zA-Z0-9-_]/g, '_')

        // Check for conflicts and add number suffix if needed
        let targetFilename = imageBasename + imageExt
        let counter = 1
        while (existsSync(path.join(assetsDir, targetFilename))) {
          targetFilename = `${imageBasename}_${counter}${imageExt}`
          counter++
        }

        const targetPath = path.join(assetsDir, targetFilename)

        // Copy the image
        await copyFile(sourcePath, targetPath)

        // Return relative path for markdown
        return `./assets/${targetFilename}`
      } catch (error) {
        console.error('Error copying image:', error)
        dialog.showErrorBox('Image Copy Error', `Could not copy image: ${error}`)
        return null
      }
    }
  )

  // Handle copying a file to a workspace folder
  ipcMain.handle(
    'file:copyToWorkspace',
    async (_event, sourcePath: string, workspaceRootPath: string) => {
      try {
        const filename = path.basename(sourcePath)
        const ext = path.extname(filename)
        const baseName = path.basename(filename, ext)

        // Check for conflicts and add number suffix if needed
        let targetFilename = filename
        let targetPath = path.join(workspaceRootPath, targetFilename)
        let counter = 1

        while (existsSync(targetPath)) {
          targetFilename = `${baseName}_${counter}${ext}`
          targetPath = path.join(workspaceRootPath, targetFilename)
          counter++
        }

        await copyFile(sourcePath, targetPath)
        return targetPath
      } catch (error) {
        console.error('Error copying file to workspace:', error)
        return null
      }
    }
  )

  // Handle auto-save
  ipcMain.handle(
    'file:autoSave',
    async (_event, tabId: string, content: string, filePath: string | null) => {
      try {
        let savePath: string

        if (filePath) {
          // If file has a path, save to that location
          savePath = filePath
        } else {
          // If file doesn't have a path, save to temp directory
          await ensureTempDir(tabId)
          savePath = getTempDraftPath(tabId)
        }

        await writeFile(savePath, content, 'utf-8')
        return savePath
      } catch (error) {
        console.error('Error during auto-save:', error)
        return null
      }
    }
  )

  // Handle getting temp directory path
  ipcMain.handle('file:getTempDir', async (_event, tabId: string) => {
    return getTempDir(tabId)
  })

  // Handle moving temp files to saved location
  ipcMain.handle('file:moveTempFiles', async (_event, tabId: string, savedPath: string) => {
    try {
      await moveTempToSaved(tabId, savedPath)
      return true
    } catch (error) {
      console.error('Error moving temp files:', error)
      dialog.showErrorBox('File Migration Error', `Could not move temporary files: ${error}`)
      return false
    }
  })

  // Handle cleanup of temp directory
  ipcMain.handle('file:cleanupTemp', async (_event, tabId: string) => {
    try {
      await cleanupTempDir(tabId)
      return true
    } catch (error) {
      console.error('Error cleaning up temp directory:', error)
      return false
    }
  })

  // Handle reading image as data URL
  ipcMain.handle('file:readImageAsDataURL', async (_event, imagePath: string) => {
    try {
      const imageBuffer = await readFile(imagePath)
      const ext = path.extname(imagePath).toLowerCase()

      // Determine MIME type
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp'
      }

      const mimeType = mimeTypes[ext] || 'image/png'
      const base64 = imageBuffer.toString('base64')
      return `data:${mimeType};base64,${base64}`
    } catch (error) {
      console.error('Error reading image as data URL:', error)
      return null
    }
  })
}
