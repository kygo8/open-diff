import { invoke } from '@tauri-apps/api/core'
import type { FolderMergePlanRequest, FolderMergePlanResponse } from '@/types/folderMerge'

export function buildFolderMergePlan(
  request: FolderMergePlanRequest,
): Promise<FolderMergePlanResponse> {
  return invoke<FolderMergePlanResponse>('build_folder_merge_plan', {
    leftRoot: request.leftRoot,
    baseRoot: request.baseRoot,
    rightRoot: request.rightRoot,
    outputRoot: request.outputRoot,
  })
}
