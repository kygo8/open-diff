import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  formatDiskFreeSpacePhrase,
  formatFreeSpaceQuantity,
  fetchPathVolumeInfo,
} from './diskFreeSpace'

vi.mock('@/app/desktopDrop', () => ({
  isTauriRuntime: vi.fn(() => true),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from '@/app/desktopDrop'

describe('diskFreeSpace', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(isTauriRuntime).mockReturnValue(true)
  })

  it('formats GB and MB quantities for capture-style footers', () => {
    expect(formatFreeSpaceQuantity(91.8 * 1024 ** 3)).toBe('91.8 GB')
    expect(formatFreeSpaceQuantity(512 * 1024 ** 2)).toBe('512 MB')
    expect(formatFreeSpaceQuantity(12.4 * 1024 ** 2)).toBe('12.4 MB')
    expect(formatDiskFreeSpacePhrase(91.8 * 1024 ** 3, 'C:\\')).toBe('91.8 GB free on C:\\')
  })

  it('invokes path_volume_info for local paths in Tauri', async () => {
    vi.mocked(invoke).mockResolvedValue({
      path: '/tmp/demo',
      freeBytes: 5 * 1024 ** 3,
      displayRoot: '/',
    })

    await expect(fetchPathVolumeInfo('/tmp/demo')).resolves.toEqual({
      path: '/tmp/demo',
      freeBytes: 5 * 1024 ** 3,
      displayRoot: '/',
    })
    expect(invoke).toHaveBeenCalledWith('path_volume_info', { path: '/tmp/demo' })
  })

  it('returns null when runtime is not Tauri or invoke fails', async () => {
    vi.mocked(isTauriRuntime).mockReturnValue(false)
    await expect(fetchPathVolumeInfo('/tmp')).resolves.toBeNull()

    vi.mocked(isTauriRuntime).mockReturnValue(true)
    vi.mocked(invoke).mockRejectedValue(new Error('nope'))
    await expect(fetchPathVolumeInfo('/tmp')).resolves.toBeNull()
  })
})
