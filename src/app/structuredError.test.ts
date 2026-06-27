import { describe, expect, it } from 'vitest'
import { createFileOperationError } from './structuredError'

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
})
