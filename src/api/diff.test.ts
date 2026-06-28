import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveTextFile } from './diff'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({
    path: 'D:/workspace/output.txt',
    bytesWritten: 12,
    backupPath: null,
    fileStamp: { size: 12, modifiedAtMs: 1 },
  }),
}))

describe('diff api', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear()
  })

  it('saves text files through the Tauri command contract', async () => {
    const result = await saveTextFile({
      path: 'D:/workspace/output.txt',
      text: 'merged text',
    })

    expect(invoke).toHaveBeenCalledWith('save_text_file', {
      path: 'D:/workspace/output.txt',
      text: 'merged text',
    })
    expect(result.bytesWritten).toBe(12)
  })
})
