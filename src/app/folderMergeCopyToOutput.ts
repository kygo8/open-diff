import type { FolderMergeActionKind, FolderMergePlanRow } from '@/types/folderMerge'

export type FolderMergeCopyToOutputAction = Extract<
  FolderMergeActionKind,
  'Copy left to output' | 'Copy right to output'
>

export interface FolderMergeCopyToOutputOverride {
  relativePath: string
  action: FolderMergeCopyToOutputAction
}

/** Pick the plan copy-to-output verb for a row from available sides. */
export function resolveCopyToOutputAction(
  row: Pick<FolderMergePlanRow, 'left' | 'right'>,
): FolderMergeCopyToOutputAction | null {
  const leftPresent = row.left.kind !== 'Missing'
  const rightPresent = row.right.kind !== 'Missing'

  if (leftPresent && !rightPresent) {
    return 'Copy left to output'
  }

  if (rightPresent && !leftPresent) {
    return 'Copy right to output'
  }

  if (leftPresent && rightPresent) {
    // Prefer left when both sides exist (matches core when fingerprints agree).
    return 'Copy left to output'
  }

  return null
}

export function buildCopyToOutputOverrides(
  rows: readonly Pick<FolderMergePlanRow, 'path' | 'left' | 'right'>[],
): FolderMergeCopyToOutputOverride[] {
  const overrides: FolderMergeCopyToOutputOverride[] = []

  for (const row of rows) {
    const action = resolveCopyToOutputAction(row)

    if (!action) {
      continue
    }

    overrides.push({ relativePath: row.path, action })
  }

  return overrides
}
