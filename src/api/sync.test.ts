import { beforeEach, describe, expect, it, vi } from 'vitest'
import { executeFolderSync, previewFolderSync } from './sync'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({
    name: 'Mirror to Right',
    leftRoot: 'D:/left',
    rightRoot: 'D:/right',
    strategy: 'mirrorRight',
    rows: [],
    summary: {
      total: 0,
      copy: 0,
      delete: 0,
      leave: 0,
      conflict: 0,
    },
  }),
}))

describe('sync api', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear()
  })

  it('previews folder sync through the Tauri command contract', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      name: 'Mirror to Right',
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      strategy: 'mirrorRight',
      rows: [
        {
          id: 'copy-app',
          relativePath: 'package/app.exe',
          action: 'Copy',
          sourcePath: 'D:/left/package/app.exe',
          targetPath: 'D:/right/package/app.exe',
          detail: 'Left item only exists',
        },
      ],
      summary: {
        total: 1,
        copy: 1,
        delete: 0,
        leave: 0,
        conflict: 0,
      },
    })

    const result = await previewFolderSync({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      strategy: 'mirrorRight',
    })

    expect(invoke).toHaveBeenCalledWith('preview_folder_sync', {
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      strategy: 'mirrorRight',
    })
    expect(result.rows[0]?.relativePath).toBe('package/app.exe')
  })

  it('executes folder sync through the Tauri command contract', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      name: 'Mirror to Right',
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      strategy: 'mirrorRight',
      total: 2,
      succeeded: 2,
      failed: 0,
      cancelled: 0,
      logs: [
        {
          relativePath: 'package/app.exe',
          action: 'copyLeftToRight',
          sourcePath: 'D:/left/package/app.exe',
          targetPath: 'D:/right/package/app.exe',
          status: 'succeeded',
          error: null,
        },
      ],
    })

    const result = await executeFolderSync({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      strategy: 'mirrorRight',
    })

    expect(invoke).toHaveBeenCalledWith('execute_folder_sync', {
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      strategy: 'mirrorRight',
    })
    expect(result.succeeded).toBe(2)
  })
})
