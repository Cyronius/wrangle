const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.mkd', '.mdwn'])

export function isMarkdownFile(filePath?: string): boolean {
  if (!filePath) return true // Unsaved files default to markdown
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  return MARKDOWN_EXTENSIONS.has(ext)
}

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.xml': 'xml',
  '.svg': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.sh': 'shell',
  '.bash': 'shell',
  '.bat': 'bat',
  '.ps1': 'powershell',
  '.sql': 'sql',
  '.r': 'r',
  '.lua': 'lua',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.toml': 'ini',
  '.ini': 'ini',
  '.cfg': 'ini',
  '.env': 'ini',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.mdown': 'markdown',
  '.mkd': 'markdown',
  '.mdwn': 'markdown',
}

export function getLanguageFromPath(filePath?: string): string {
  if (!filePath) return 'markdown'
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  return EXTENSION_TO_LANGUAGE[ext] || 'plaintext'
}
