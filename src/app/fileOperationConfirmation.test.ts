import { describe, expect, it } from 'vitest'
import { createFileOperationConfirmation } from './fileOperationConfirmation'

describe('createFileOperationConfirmation', () => {
  it('creates a high-risk delete confirmation with affected paths', () => {
    expect(
      createFileOperationConfirmation({
        operation: 'delete',
        paths: ['C:/work/old.txt'],
      }),
    ).toEqual({
      operation: 'delete',
      title: 'Delete 1 item?',
      risk: 'high',
      confirmLabel: 'Delete',
      paths: ['C:/work/old.txt'],
      message: 'This operation can remove files or folders from disk.',
    })
  })

  it('creates a high-risk overwrite confirmation with source and target paths', () => {
    expect(
      createFileOperationConfirmation({
        operation: 'overwrite',
        paths: ['C:/work/source.txt', 'C:/work/target.txt'],
      }),
    ).toMatchObject({
      title: 'Overwrite 2 items?',
      risk: 'high',
      confirmLabel: 'Overwrite',
    })
  })

  it('creates a medium-risk copy confirmation', () => {
    expect(
      createFileOperationConfirmation({
        operation: 'copy',
        paths: ['C:/work/source.txt', 'C:/work/target.txt'],
      }),
    ).toMatchObject({
      title: 'Copy 2 items?',
      risk: 'medium',
      confirmLabel: 'Copy',
    })
  })
})
