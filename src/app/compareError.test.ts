import { describe, expect, it } from 'vitest'
import { formatCompareError } from './compareError'

const t = (key: string): string => key

describe('formatCompareError', () => {
  it('maps empty and undefined noise to a readable compare failure', () => {
    expect(formatCompareError(undefined, t)).toBe('error.compare.failed')
    expect(formatCompareError('undefined', t)).toBe('error.compare.failed')
    expect(formatCompareError({}, t)).toBe('error.compare.failed')
    expect(formatCompareError('[object Object]', t)).toBe('error.compare.failed')
  })

  it('maps missing-path and cancel patterns', () => {
    expect(formatCompareError(new Error('ENOENT: no such file'), t)).toBe(
      'error.compare.pathMissing',
    )
    expect(formatCompareError('cancelled by user', t)).toBe('error.compare.cancelled')
  })

  it('keeps short concrete messages', () => {
    expect(formatCompareError(new Error('Folder locked'), t)).toBe('Folder locked')
  })

  it('extracts debugMessage from Tauri AppErrorPayload objects', () => {
    expect(
      formatCompareError(
        {
          code: 'app.unknown',
          messageKey: 'error.app.unknown.title',
          params: {},
          debugMessage: 'unsupported media container',
        },
        t,
      ),
    ).toBe('unsupported media container')

    expect(
      formatCompareError(
        {
          code: 'file.notFound',
          message_key: 'error.file.notFound.message',
          debug_message: 'No such file or directory (os error 2)',
        },
        t,
      ),
    ).toBe('error.compare.pathMissing')
  })

  it('does not stringify plain objects as [object Object]', () => {
    expect(formatCompareError({ code: 'app.unknown', nested: { a: 1 } }, t)).toBe(
      'error.compare.failed',
    )
    expect(formatCompareError({ message: { nested: true } }, t)).toBe('error.compare.failed')
  })
})
