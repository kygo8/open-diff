import { invoke } from '@tauri-apps/api/core'
import type {
  FileStamp,
  MediaCompareRequest,
  MediaCompareResponse,
  PictureCompareRequest,
  PictureCompareResponse,
  TextPatchResponse,
  ReadTextFileResponse,
  SaveTextFileRequest,
  SaveTextFileResponse,
  TableCompareRequest,
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

export function compareMediaFiles(request: MediaCompareRequest): Promise<MediaCompareResponse> {
  return invoke<MediaCompareResponse>('compare_media_files', {
    leftPath: request.leftPath,
    rightPath: request.rightPath,
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
