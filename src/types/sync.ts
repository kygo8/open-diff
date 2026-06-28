export type FolderSyncStrategy =
  | 'updateRight'
  | 'updateLeft'
  | 'updateBoth'
  | 'mirrorRight'
  | 'mirrorLeft'

export interface FolderSyncPreviewRequest {
  leftRoot: string
  rightRoot: string
  strategy: FolderSyncStrategy
}

export type FolderSyncPreviewAction = 'Copy' | 'Delete' | 'Leave' | 'Conflict'

export interface FolderSyncPreviewRow {
  id: string
  relativePath: string
  action: FolderSyncPreviewAction
  sourcePath?: string
  targetPath?: string
  detail: string
}

export interface FolderSyncPreviewSummary {
  total: number
  copy: number
  delete: number
  leave: number
  conflict: number
}

export interface FolderSyncPreviewResponse {
  name: string
  leftRoot: string
  rightRoot: string
  strategy: FolderSyncStrategy
  rows: FolderSyncPreviewRow[]
  summary: FolderSyncPreviewSummary
}
