import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { notifyCompareComplete, playCompareCompleteBeep } from './compareCompleteNotify'

describe('compareCompleteNotify', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no-ops when disabled', async () => {
    const AudioContextMock = vi.fn()

    vi.stubGlobal('AudioContext', AudioContextMock)
    await notifyCompareComplete(false, 'title', 'body')
    expect(AudioContextMock).not.toHaveBeenCalled()
  })

  it('plays a short beep when enabled', () => {
    const stop = vi.fn()
    const start = vi.fn()
    const connect = vi.fn()
    const exponentialRampToValueAtTime = vi.fn()
    const close = vi.fn().mockResolvedValue(undefined)
    const oscillator = {
      type: 'sine',
      frequency: { value: 0 },
      connect,
      start,
      stop,
    }
    const gain = {
      gain: { value: 0, exponentialRampToValueAtTime },
      connect,
    }
    const ctx = {
      currentTime: 0,
      createOscillator: () => oscillator,
      createGain: () => gain,
      destination: {},
      close,
    }

    vi.stubGlobal(
      'AudioContext',
      vi.fn(function AudioContext(this: unknown) {
        return ctx
      }),
    )
    playCompareCompleteBeep()
    expect(start).toHaveBeenCalled()
    expect(stop).toHaveBeenCalled()
  })
})
