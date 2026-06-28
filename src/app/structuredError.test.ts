import { describe, expect, it } from 'vitest'
import { createAppI18n } from '@/i18n'
import { createFileOperationError, resolveLocalizedAppError } from './structuredError'

describe('createFileOperationError', () => {
  it('creates a structured file operation error with path and suggestion', () => {
    expect(
      createFileOperationError({
        operation: 'delete',
        path: 'C:/work/locked.txt',
        reason: 'Permission denied',
      }),
    ).toEqual({
      operation: 'delete',
      path: 'C:/work/locked.txt',
      reason: 'Permission denied',
      suggestion: 'Check file permissions and try again.',
    })
  })

  it('allows custom recovery suggestions', () => {
    expect(
      createFileOperationError({
        operation: 'copy',
        path: 'C:/work/target.txt',
        reason: 'Target exists',
        suggestion: 'Choose overwrite to replace the target.',
      }),
    ).toMatchObject({
      suggestion: 'Choose overwrite to replace the target.',
    })
  })

  it('maps backend error codes to localized user-facing copy', () => {
    const i18n = createAppI18n('zh-CN')

    expect(
      resolveLocalizedAppError(
        {
          code: 'file.notFound',
          messageKey: 'error.file.notFound.message',
          params: { path: 'C:/work/missing.txt' },
          debugMessage: 'No such file or directory',
        },
        i18n.t,
      ),
    ).toEqual({
      code: 'file.notFound',
      title: '文件不存在',
      message: '找不到 C:/work/missing.txt。',
      suggestion: '确认路径存在后重试。',
      debugMessage: 'No such file or directory',
    })
  })
})
