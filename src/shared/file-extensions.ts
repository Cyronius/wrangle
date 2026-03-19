// Shared file extension definitions used by both main and renderer processes

export const MARKDOWN_EXTENSIONS = new Set([
  '.md', '.markdown', '.mdown', '.mkd', '.mdwn'
])

export const IMAGE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'
])

// Extensions known to be text files
export const TEXT_EXTENSIONS = new Set([
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

function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return ''
  return filename.slice(lastDot).toLowerCase()
}

export function isTextFile(filename: string): boolean {
  return TEXT_EXTENSIONS.has(getExtension(filename))
}

export function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(getExtension(filename))
}

export function isMarkdownExtension(filename: string): boolean {
  return MARKDOWN_EXTENSIONS.has(getExtension(filename))
}
