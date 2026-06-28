import { invoke } from '@tauri-apps/api/core'
import type { FolderSyncPreviewRequest, FolderSyncPreviewResponse } from '@/types/sync'

export function previewFolderSync(
  request: FolderSyncPreviewRequest,
): Promise<FolderSyncPreviewResponse> {
  return invoke<FolderSyncPreviewResponse>('preview_folder_sync', {
    leftRoot: request.leftRoot,
    rightRoot: request.rightRoot,
    strategy: request.strategy,
  })
}
