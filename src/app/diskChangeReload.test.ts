import { describe, expect, it, vi } from 'vitest'
import {
  anyPathChangedOnDisk,
  clampBinaryCompareBufferSize,
  shouldAutoReloadDiskChange,
} from './diskChangeReload'
import type { FileStamp } from '@/types/diff'

const stamp = (size: number): FileStamp => ({
  size,
  modifiedAtMs: 1_700_000_000_000,
})

describe('diskChangeReload', () => {
  it('detects a changed side via the checker', async () => {
    const check = vi.fn((path: string) => Promise.resolve(path === '/right.txt'))

    await expect(
      anyPathChangedOnDisk(
        [
          { path: '/left.txt', stamp: stamp(10) },
          { path: '/right.txt', stamp: stamp(12) },
        ],
        check,
      ),
    ).resolves.toBe(true)
    expect(check).toHaveBeenCalled()
  })

  it('ignores empty paths and checker failures', async () => {
    const check = vi.fn(() => Promise.reject(new Error('gone')))

    await expect(
      anyPathChangedOnDisk(
        [
          { path: '', stamp: stamp(1) },
          { path: '/missing.txt', stamp: stamp(2) },
        ],
        check,
      ),
    ).resolves.toBe(false)
  })

  it('auto-reloads only when enabled and clean', () => {
    expect(
      shouldAutoReloadDiskChange({ autoReloadUnlessChangesDiscarded: true, dirty: false }),
    ).toBe(true)
    expect(
      shouldAutoReloadDiskChange({ autoReloadUnlessChangesDiscarded: true, dirty: true }),
    ).toBe(false)
    expect(
      shouldAutoReloadDiskChange({ autoReloadUnlessChangesDiscarded: false, dirty: false }),
    ).toBe(false)
  })

  it('clamps binary compare buffer sizes to supported choices', () => {
    expect(clampBinaryCompareBufferSize(256)).toBe(256)
    expect(clampBinaryCompareBufferSize(700)).toBe(512)
    expect(clampBinaryCompareBufferSize(5000)).toBe(4096)
    expect(clampBinaryCompareBufferSize('nope')).toBe(256)
  })
})
