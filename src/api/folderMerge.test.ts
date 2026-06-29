import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildFolderMergePlan } from './folderMerge'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({
    leftRoot: 'D:/merge/left',
    baseRoot: 'D:/merge/base',
    rightRoot: 'D:/merge/right',
    outputRoot: 'D:/merge/output',
    rows: [],
    summary: {
      actions: 0,
      automatic: 0,
      conflicts: 0,
    },
  }),
}))

describe('folder merge api', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear()
  })

  it('builds folder merge plan through the Tauri command contract', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      leftRoot: 'D:/merge/left',
      baseRoot: 'D:/merge/base',
      rightRoot: 'D:/merge/right',
      outputRoot: 'D:/merge/output',
      rows: [
        {
          id: 'config',
          path: 'config',
          base: { role: 'Base', kind: 'Directory' },
          left: { role: 'Left', kind: 'File', size: '4 B' },
          right: { role: 'Right', kind: 'Directory' },
          action: 'Mark conflict',
          detail: 'Left and right changed the same path differently.',
          conflict: {
            path: 'config',
            reason: 'Left and right changed the same path differently',
            baseContext: 'Base: Directory',
            leftContext: 'Left: File',
            rightContext: 'Right: Directory',
          },
        },
      ],
      summary: {
        actions: 1,
        automatic: 0,
        conflicts: 1,
      },
    })

    const result = await buildFolderMergePlan({
      leftRoot: 'D:/merge/left',
      baseRoot: 'D:/merge/base',
      rightRoot: 'D:/merge/right',
      outputRoot: 'D:/merge/output',
    })

    expect(invoke).toHaveBeenCalledWith('build_folder_merge_plan', {
      leftRoot: 'D:/merge/left',
      baseRoot: 'D:/merge/base',
      rightRoot: 'D:/merge/right',
      outputRoot: 'D:/merge/output',
    })
    expect(result.rows[0]?.action).toBe('Mark conflict')
    expect(result.summary.conflicts).toBe(1)
  })
})
