/** Helpers for Folder Compare Copy/Move to Side and Folder Actions. */

export type FolderTransferSide = 'Left' | 'Right'

export interface FolderTransferRow {
  kind?: 'file' | 'directory'
  relativePath?: string
  leftPath?: string
  rightPath?: string
}

export function joinTransferPath(root: string, relativePath: string, fileName?: string): string {
  const normalizedRoot = root.replaceAll('\\', '/').replace(/\/$/u, '')
  const relative = relativePath.replaceAll('\\', '/').replace(/^\//u, '')
  const base = relative ? `${normalizedRoot}/${relative}` : normalizedRoot

  if (!fileName) {
    return base
  }

  const name = fileName.replaceAll('\\', '/').replace(/^\/+/u, '')

  return `${base.replace(/\/$/u, '')}/${name}`
}

export function entryBaseName(path: string): string {
  const normalized = path.replaceAll('\\', '/')
  const index = normalized.lastIndexOf('/')

  return index < 0 ? normalized : normalized.slice(index + 1)
}

/**
 * Infer which side should receive a Copy to Side for a single row.
 * Left-only → Right, Right-only → Left, both → ambiguous, neither → null.
 */
export function inferCopyToSideDirection(
  row: FolderTransferRow,
): FolderTransferSide | 'ambiguous' | null {
  const hasLeft = Boolean(row.leftPath)
  const hasRight = Boolean(row.rightPath)

  if (hasLeft && !hasRight) {
    return 'Right'
  }

  if (hasRight && !hasLeft) {
    return 'Left'
  }

  if (hasLeft && hasRight) {
    return 'ambiguous'
  }

  return null
}

export function inferCopyToSideDirectionForRows(
  rows: FolderTransferRow[],
): FolderTransferSide | 'ambiguous' | null {
  if (rows.length === 0) {
    return null
  }

  let resolved: FolderTransferSide | null = null

  for (const row of rows) {
    const direction = inferCopyToSideDirection(row)

    if (direction === null) {
      continue
    }

    if (direction === 'ambiguous') {
      return 'ambiguous'
    }

    if (resolved && resolved !== direction) {
      return 'ambiguous'
    }

    resolved = direction
  }

  return resolved
}

export interface SideTransferPlan {
  sourcePath: string
  targetPath: string
  relativePath: string
}

/**
 * Build move/copy-to-side plans. `toSide` is the destination side.
 * Source is the opposite side when present; otherwise the destination existing path is skipped.
 */
export function folderSideTransferPlans(
  rows: FolderTransferRow[],
  toSide: FolderTransferSide,
  leftRoot: string,
  rightRoot: string,
): SideTransferPlan[] {
  const plans: SideTransferPlan[] = []
  const targetRoot = toSide === 'Left' ? leftRoot : rightRoot

  if (!targetRoot) {
    return plans
  }

  for (const row of rows) {
    if (!row.relativePath) {
      continue
    }

    const sourcePath = toSide === 'Left' ? row.rightPath : row.leftPath

    if (!sourcePath) {
      continue
    }

    plans.push({
      sourcePath,
      targetPath: joinTransferPath(targetRoot, row.relativePath),
      relativePath: row.relativePath,
    })
  }

  return plans
}

export function folderExternalTransferPlans(
  rows: FolderTransferRow[],
  destinationFolder: string,
): SideTransferPlan[] {
  const plans: SideTransferPlan[] = []
  const dest = destinationFolder.replaceAll('\\', '/').replace(/\/$/u, '')

  if (!dest) {
    return plans
  }

  for (const row of rows) {
    const sourcePath = row.leftPath ?? row.rightPath

    if (!sourcePath) {
      continue
    }

    const name = entryBaseName(sourcePath)

    if (!name) {
      continue
    }

    plans.push({
      sourcePath,
      targetPath: `${dest}/${name}`,
      relativePath: row.relativePath ?? name,
    })
  }

  return plans
}

/** Prefer the focused side when both roots are writable; otherwise the only writable side. */
export function resolveNewFolderRoots(options: {
  leftRoot: string
  rightRoot: string
  leftWritable: boolean
  rightWritable: boolean
  focusedSide: 'left' | 'right'
}): string[] {
  const roots: string[] = []

  if (options.focusedSide === 'left' && options.leftRoot && options.leftWritable) {
    roots.push(options.leftRoot)
  } else if (options.focusedSide === 'right' && options.rightRoot && options.rightWritable) {
    roots.push(options.rightRoot)
  }

  if (roots.length > 0) {
    return roots
  }

  if (options.leftRoot && options.leftWritable) {
    roots.push(options.leftRoot)
  }

  if (options.rightRoot && options.rightWritable) {
    roots.push(options.rightRoot)
  }

  return roots
}
