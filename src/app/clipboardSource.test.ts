import { afterEach, describe, expect, it, vi } from 'vitest'
import { readClipboardTextSource } from './clipboardSource'

const originalClipboard = navigator.clipboard

describe('readClipboardTextSource', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    })
  })

  it('creates a text compare source from clipboard text', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockResolvedValue('clipboard text'),
      },
    })

    await expect(readClipboardTextSource()).resolves.toEqual({
      kind: 'clipboard-text',
      title: 'ui.clipboardText',
      text: 'clipboard text',
    })
  })

  it('returns a structured error when clipboard text is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })

    await expect(readClipboardTextSource()).rejects.toMatchObject({
      code: 'clipboard-unavailable',
    })
  })
})
