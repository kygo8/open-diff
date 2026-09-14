import { invoke } from '@tauri-apps/api/core'
import type {
  ApplyTextPatchRequest,
  ApplyTextPatchToFileRequest,
  ApplyTextPatchResponse,
  ChangeFolderEntryAttributesRequest,
  DeleteFolderEntryRequest,
  ExportFolderCompareReportRequest,
  ExportReportResponse,
  ExportTextCompareReportRequest,
  FileStamp,
  FolderCompareCopyRequest,
  FolderCompareCopyResponse,
  FolderCompareRequest,
  FolderCompareResponse,
  FolderFileOperationResponse,
  FolderMetadataUpdateResponse,
  HexCompareRequest,
  HexCompareResponse,
  HexFindMatch,
  HexFindRequest,
  HexSaveRequest,
  HexSaveResult,
  MediaCompareRequest,
  MediaCompareResponse,
  MoveFolderEntryRequest,
  PictureCompareRequest,
  PictureCompareResponse,
  RegistryCompareRequest,
  RegistryLiveCompareRequest,
  RegistryHiveCompareRequest,
  RegistryCompareResponse,
  ApplyLiveRegistryValueRequest,
  ApplyLiveRegistryValueResponse,
  RenameFolderEntryRequest,
  TextMergeRequest,
  TextMergeResponse,
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
    createBackup: request.createBackup ?? true,
  })
}

export function checkTextFileChanged(path: string, previousStamp: FileStamp): Promise<boolean> {
  return invoke<boolean>('check_text_file_changed', {
    path,
    previousStamp,
  })
}

export function compareTableCsv(request: TableCompareRequest): Promise<TableCompareResponse> {
  return compareTable(request)
}

export function compareTable(request: TableCompareRequest): Promise<TableCompareResponse> {
  return invoke<TableCompareResponse>('compare_table', {
    left: request.left,
    right: request.right,
    format: request.format,
    leftPath: request.leftPath,
    rightPath: request.rightPath,
    leftSheet: request.leftSheet,
    rightSheet: request.rightSheet,
    keyColumnIndices: request.keyColumnIndices,
    ignoredColumns: request.ignoredColumns,
    manualMappings: request.manualMappings,
    delimiter: request.delimiter,
  })
}

export function compareFolderPaths(request: FolderCompareRequest): Promise<FolderCompareResponse> {
  return invoke<FolderCompareResponse>('compare_folder_paths', {
    leftRoot: request.leftRoot,
    rightRoot: request.rightRoot,
    criteria: request.criteria,
    filters: request.filters,
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
    rgbTolerance: request.rgbTolerance,
    compareAlpha: request.compareAlpha,
    alphaTolerance: request.alphaTolerance,
    ignoreColorFrom: request.ignoreColorFrom,
    ignoreColorTo: request.ignoreColorTo,
  })
}

export function mergeTextFiles(request: TextMergeRequest): Promise<TextMergeResponse> {
  return invoke<TextMergeResponse>('merge_text_files', {
    leftPath: request.leftPath,
    rightPath: request.rightPath,
    centerPath: request.centerPath,
    outputPath: request.outputPath,
    conflictPolicy: request.conflictPolicy,
  })
}

export function exportTextCompareReport(
  request: ExportTextCompareReportRequest,
): Promise<ExportReportResponse> {
  return invoke<ExportReportResponse>('export_text_compare_report', {
    left: request.left,
    right: request.right,
    leftSource: request.leftSource,
    rightSource: request.rightSource,
    format: request.format,
    outputPath: request.outputPath,
    algorithm: request.algorithm,
    ignoreWhitespace: request.ignoreWhitespace,
    ignoreCase: request.ignoreCase,
    ignoreLineEndings: request.ignoreLineEndings,
    ignoreRegexes: request.ignoreRegexes,
  })
}

export function exportFolderCompareReport(
  request: ExportFolderCompareReportRequest,
): Promise<ExportReportResponse> {
  return invoke<ExportReportResponse>('export_folder_compare_report', {
    leftRoot: request.leftRoot,
    rightRoot: request.rightRoot,
    format: request.format,
    outputPath: request.outputPath,
  })
}

export function findHexInFile(request: HexFindRequest): Promise<HexFindMatch[]> {
  return invoke<HexFindMatch[]>('find_hex_in_file', {
    path: request.path,
    queryKind: request.queryKind,
    query: request.query,
  })
}

export function saveHexEdits(request: HexSaveRequest): Promise<HexSaveResult> {
  return invoke<HexSaveResult>('save_hex_edits', {
    path: request.path,
    edits: request.edits,
    createBackup: request.createBackup ?? true,
  })
}

export function moveFolderEntry(
  request: MoveFolderEntryRequest,
): Promise<FolderFileOperationResponse> {
  return invoke<FolderFileOperationResponse>('move_folder_entry', {
    sourcePath: request.sourcePath,
    targetPath: request.targetPath,
  })
}

export function createFolderSnapshot(request: {
  sourceRoot: string
  outputPath: string
  name?: string
}): Promise<string> {
  return invoke<string>('create_folder_snapshot', {
    sourceRoot: request.sourceRoot,
    outputPath: request.outputPath,
    name: request.name,
  })
}

export function applyTextPatch(request: ApplyTextPatchRequest): Promise<ApplyTextPatchResponse> {
  return invoke<ApplyTextPatchResponse>('apply_text_patch', {
    source: request.source,
    patch: request.patch,
  })
}

export function applyTextPatchToFile(
  request: ApplyTextPatchToFileRequest,
): Promise<ApplyTextPatchResponse> {
  return invoke<ApplyTextPatchResponse>('apply_text_patch_to_file', {
    sourcePath: request.sourcePath,
    patch: request.patch,
    outputPath: request.outputPath,
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

export function compareRegistryLiveKeys(
  request: RegistryLiveCompareRequest,
): Promise<RegistryCompareResponse> {
  return invoke<RegistryCompareResponse>('compare_registry_live_keys', {
    leftKey: request.leftKey,
    rightKey: request.rightKey,
    leftName: request.leftName,
    rightName: request.rightName,
  })
}

export function compareRegistryHiveFiles(
  request: RegistryHiveCompareRequest,
): Promise<RegistryCompareResponse> {
  return invoke<RegistryCompareResponse>('compare_registry_hive_files', {
    leftPath: request.leftPath,
    rightPath: request.rightPath,
    leftRoot: request.leftRoot,
    rightRoot: request.rightRoot,
    leftName: request.leftName,
    rightName: request.rightName,
  })
}

export function applyLiveRegistryValue(
  request: ApplyLiveRegistryValueRequest,
): Promise<ApplyLiveRegistryValueResponse> {
  return invoke<ApplyLiveRegistryValueResponse>('apply_live_registry_value', {
    targetKey: request.targetKey,
    name: request.name,
    kind: request.kind,
    data: request.data,
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
