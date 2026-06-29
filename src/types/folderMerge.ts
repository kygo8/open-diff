export interface FolderMergePlanRequest {
  leftRoot: string
  baseRoot: string
  rightRoot: string
  outputRoot: string
}

export type FolderMergeRole = 'Base' | 'Left' | 'Right'
export type FolderMergeEntryKind = 'File' | 'Directory' | 'Missing'
export type FolderMergeActionKind =
  | 'Keep output'
  | 'Copy left to output'
  | 'Copy right to output'
  | 'Delete output'
  | 'Mark conflict'

export interface FolderMergeSide {
  role: FolderMergeRole
  kind: FolderMergeEntryKind
  size?: string
  modified?: string
}

export interface FolderMergeConflict {
  path: string
  reason: string
  baseContext: string
  leftContext: string
  rightContext: string
}

export interface FolderMergePlanRow {
  id: string
  path: string
  base: FolderMergeSide
  left: FolderMergeSide
  right: FolderMergeSide
  action: FolderMergeActionKind
  detail: string
  conflict?: FolderMergeConflict
}

export interface FolderMergePlanSummary {
  actions: number
  automatic: number
  conflicts: number
}

export interface FolderMergePlanResponse {
  leftRoot: string
  baseRoot: string
  rightRoot: string
  outputRoot: string
  rows: FolderMergePlanRow[]
  summary: FolderMergePlanSummary
}
