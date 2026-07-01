import { invoke } from '@tauri-apps/api/core'
import type {
  ChangeFolderEntryAttributesRequest,
  DeleteFolderEntryRequest,
  FileStamp,
  FolderCompareCopyRequest,
  FolderCompareCopyResponse,
  FolderCompareRequest,
  FolderCompareResponse,
  FolderFileOperationResponse,
  FolderMetadataUpdateResponse,
  HexCompareRequest,
  HexCompareResponse,
  MediaCompareRequest,
  MediaCompareResponse,
  PictureCompareRequest,
  PictureCompareResponse,
  RegistryCompareRequest,
  RegistryCompareResponse,
  RenameFolderEntryRequest,
  TextPatchResponse,
  VersionCompareRequest,
  VersionCompareResponse,
  ReadTextFileResponse,
  SaveTextFileRequest,
  SaveTextFileResponse,
  TableCompareRequest,
  TouchFolderEntryRequest,
  TableCompareResponse,
  TextDiffRequest,
  TextDiffResponse,
} from '@/types/diff'

export function diffText(request: TextDiffRequest): Promise<TextDiffResponse> {
  return invoke<TextDiffResponse>('diff_text', {
    left: request.left,
    right: request.right,
    algorithm: request.algorithm ?? 'myers',
    ignoreWhitespace: request.ignoreWhitespace ?? false,
    ignoreCase: request.ignoreCase ?? false,
    ignoreLineEndings: request.ignoreLineEndings ?? false,
    ignoreRegexes: request.ignoreRegexes ?? [],
  })
}

export function parseTextPatch(input: string): Promise<TextPatchResponse> {
  return invoke<TextPatchResponse>('parse_text_patch', { input })
}

export function readTextFile(path: string): Promise<ReadTextFileResponse> {
  return invoke<ReadTextFileResponse>('read_text_file', { path })
}

export function saveTextFile(request: SaveTextFileRequest): Promise<SaveTextFileResponse> {
  return invoke<SaveTextFileResponse>('save_text_file', {
    path: request.path,
    text: request.text,
  })
}

export function checkTextFileChanged(path: string, previousStamp: FileStamp): Promise<boolean> {
  return invoke<boolean>('check_text_file_changed', {
    path,
    previousStamp,
  })
}

export function compareTableCsv(request: TableCompareRequest): Promise<TableCompareResponse> {
  return invoke<TableCompareResponse>('compare_table_csv', {
    left: request.left,
    right: request.right,
  })
}

export function compareFolderPaths(request: FolderCompareRequest): Promise<FolderCompareResponse> {
  return invoke<FolderCompareResponse>('compare_folder_paths', {
    leftRoot: request.leftRoot,
    rightRoot: request.rightRoot,
  })
}

export function copyFolderCompareEntry(
  request: FolderCompareCopyRequest,
): Promise<FolderCompareCopyResponse> {
  return invoke<FolderCompareCopyResponse>('copy_folder_compare_entry', {
    leftRoot: request.leftRoot,
    rightRoot: request.rightRoot,
    relativePath: request.relativePath,
    direction: request.direction,
  })
}

export function renameFolderEntry(
  request: RenameFolderEntryRequest,
): Promise<FolderFileOperationResponse> {
  return invoke<FolderFileOperationResponse>('rename_folder_entry', {
    path: request.path,
    newName: request.newName,
  })
}

export function deleteFolderEntry(
  request: DeleteFolderEntryRequest,
): Promise<FolderFileOperationResponse> {
  return invoke<FolderFileOperationResponse>('delete_folder_entry', {
    path: request.path,
  })
}

export function changeFolderEntryAttributes(
  request: ChangeFolderEntryAttributesRequest,
): Promise<FolderMetadataUpdateResponse> {
  return invoke<FolderMetadataUpdateResponse>('change_folder_entry_attributes', {
    path: request.path,
    readonly: request.readonly,
  })
}

export function touchFolderEntry(
  request: TouchFolderEntryRequest,
): Promise<FolderMetadataUpdateResponse> {
  return invoke<FolderMetadataUpdateResponse>('touch_folder_entry', {
    path: request.path,
    modifiedAtMs: request.modifiedAtMs,
  })
}

export function compareMediaFiles(request: MediaCompareRequest): Promise<MediaCompareResponse> {
  return invoke<MediaCompareResponse>('compare_media_files', {
    leftPath: request.leftPath,
    rightPath: request.rightPath,
  })
}

export function compareHexFiles(request: HexCompareRequest): Promise<HexCompareResponse> {
  return invoke<HexCompareResponse>('compare_hex_files', {
    leftPath: request.leftPath,
    rightPath: request.rightPath,
    offset: request.offset,
    length: request.length,
  })
}

export function comparePictureFiles(
  request: PictureCompareRequest,
): Promise<PictureCompareResponse> {
  return invoke<PictureCompareResponse>('compare_picture_files', {
    leftPath: request.leftPath,
    rightPath: request.rightPath,
  })
}

export function compareRegistryExports(
  request: RegistryCompareRequest,
): Promise<RegistryCompareResponse> {
  return invoke<RegistryCompareResponse>('compare_registry_exports', {
    left: request.left,
    right: request.right,
    leftName: request.leftName,
    rightName: request.rightName,
  })
}

export function compareVersionFiles(
  request: VersionCompareRequest,
): Promise<VersionCompareResponse> {
  return invoke<VersionCompareResponse>('compare_version_files', {
    leftPath: request.leftPath,
    rightPath: request.rightPath,
  })
}
