import { invoke } from '@tauri-apps/api/core'
import type { ReadTextFileResponse, TextDiffRequest, TextDiffResponse } from '@/types/diff'

export function diffText(request: TextDiffRequest): Promise<TextDiffResponse> {
  return invoke<TextDiffResponse>('diff_text', {
    left: request.left,
    right: request.right,
    algorithm: request.algorithm ?? 'myers',
  })
}

export function readTextFile(path: string): Promise<ReadTextFileResponse> {
  return invoke<ReadTextFileResponse>('read_text_file', { path })
}
