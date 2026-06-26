import { invoke } from '@tauri-apps/api/core'
import type { TextDiffRequest, TextDiffResponse } from '@/types/diff'

export function diffText(request: TextDiffRequest): Promise<TextDiffResponse> {
  return invoke<TextDiffResponse>('diff_text', { left: request.left, right: request.right })
}
