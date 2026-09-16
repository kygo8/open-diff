/** Resolve parent directories for New Folder under folder session roots. */

export function joinFolderSidePath(root: string, relativePath: string): string {
  const normalizedRoot = root.replaceAll('\\', '/').replace(/\/$/u, '')
  const normalizedRelativePath = relativePath.replaceAll('\\', '/').replace(/^\//u, '')

  if (!normalizedRelativePath) {
    return normalizedRoot
  }

  return `${normalizedRoot}/${normalizedRelativePath}`
}

export function parentRelativePath(relativePath: string): string {
  const normalized = relativePath.replaceAll('\\', '/').replace(/^\//u, '').replace(/\/$/u, '')

  if (!normalized) {
    return ''
  }

  const index = normalized.lastIndexOf('/')

  if (index < 0) {
    return ''
  }

  return normalized.slice(0, index)
}

/**
 * Relative parent for a new folder: inside a selected directory, or beside a selected file.
 * Empty selection / empty relative path creates at the session root.
 */
export function newFolderParentRelativePath(options: {
  selectedRelativePath?: string
  selectedKind?: 'file' | 'directory'
}): string {
  const relative = (options.selectedRelativePath ?? '').replaceAll('\\', '/').replace(/^\//u, '')

  if (!relative) {
    return ''
  }

  if (options.selectedKind === 'directory') {
    return relative
  }

  return parentRelativePath(relative)
}

export function resolveNewFolderPaths(options: {
  roots: string[]
  folderName: string
  parentRelativePath?: string
}): string[] {
  const name = options.folderName.trim()

  if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    return []
  }

  const parent = (options.parentRelativePath ?? '').replaceAll('\\', '/').replace(/^\//u, '')
  const paths: string[] = []

  for (const root of options.roots) {
    const trimmed = root.trim()

    if (!trimmed) {
      continue
    }

    const parentPath = joinFolderSidePath(trimmed, parent)

    paths.push(joinFolderSidePath(parentPath, name))
  }

  return paths
}
