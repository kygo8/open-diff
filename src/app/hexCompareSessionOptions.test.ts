import { describe, expect, it } from 'vitest'
import {
  defaultHexCompareSessionOptions,
  loadHexCompareSessionOptions,
  resolveHexBytesPerRow,
  saveHexCompareSessionOptions,
} from './hexCompareSessionOptions'

describe('hexCompareSessionOptions', () => {
  it('clamps window length and persists diff-only plus bytes-per-row', () => {
    const storage = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null
      },
      setItem(key: string, value: string) {
        this.store[key] = value
      },
    }

    expect(loadHexCompareSessionOptions(storage)).toEqual(defaultHexCompareSessionOptions())

    saveHexCompareSessionOptions({ windowLength: 8, diffOnly: true, bytesPerRow: '8' }, storage)
    expect(loadHexCompareSessionOptions(storage)).toEqual({
      windowLength: 16,
      diffOnly: true,
      bytesPerRow: '8',
    })

    expect(resolveHexBytesPerRow('auto', 320)).toBe(8)
    expect(resolveHexBytesPerRow('auto', 800)).toBe(16)
    expect(resolveHexBytesPerRow('8', 800)).toBe(8)
  })
})
