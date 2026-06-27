import { invoke } from '@tauri-apps/api/core'
import type {
  FileStamp,
  ReadTextFileResponse,
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

export function readTextFile(path: string): Promise<ReadTextFileResponse> {
  return invoke<ReadTextFileResponse>('read_text_file', { path })
}

export function checkTextFileChanged(path: string, previousStamp: FileStamp): Promise<boolean> {
  return invoke<boolean>('check_text_file_changed', {
    path,
    previousStamp,
  })
}
