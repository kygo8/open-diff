import { invoke } from '@tauri-apps/api/core'
import type {
  FolderSyncExecutionResponse,
  FolderSyncPreviewRequest,
  FolderSyncPreviewResponse,
} from '@/types/sync'

export function previewFolderSync(
  request: FolderSyncPreviewRequest,
): Promise<FolderSyncPreviewResponse> {
  return invoke<FolderSyncPreviewResponse>('preview_folder_sync', {
    leftRoot: request.leftRoot,
    rightRoot: request.rightRoot,
    strategy: request.strategy,
    archiveExtensions: request.archiveExtensions,
  })
}

export function executeFolderSync(
  request: FolderSyncPreviewRequest,
): Promise<FolderSyncExecutionResponse> {
  return invoke<FolderSyncExecutionResponse>('execute_folder_sync', {
    leftRoot: request.leftRoot,
    rightRoot: request.rightRoot,
    strategy: request.strategy,
    overrides: request.overrides ?? [],
    archiveExtensions: request.archiveExtensions,
  })
}
