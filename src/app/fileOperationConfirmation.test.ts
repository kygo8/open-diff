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
      risk: 'high',
      riskKey: 'fileOperation.risk.high',
      titleKey: 'fileOperation.delete.title',
      titleParams: { count: 1 },
      confirmLabelKey: 'ui.delete',
      paths: ['C:/work/old.txt'],
      messageKey: 'fileOperation.delete.message',
    })
  })

  it('creates a high-risk overwrite confirmation with source and target paths', () => {
    expect(
      createFileOperationConfirmation({
        operation: 'overwrite',
        paths: ['C:/work/source.txt', 'C:/work/target.txt'],
      }),
    ).toMatchObject({
      risk: 'high',
      riskKey: 'fileOperation.risk.high',
      titleKey: 'fileOperation.overwrite.titlePlural',
      titleParams: { count: 2 },
      confirmLabelKey: 'ui.overwrite',
    })
  })

  it('creates a medium-risk copy confirmation', () => {
    expect(
      createFileOperationConfirmation({
        operation: 'copy',
        paths: ['C:/work/source.txt', 'C:/work/target.txt'],
      }),
    ).toMatchObject({
      risk: 'medium',
      riskKey: 'fileOperation.risk.medium',
      titleKey: 'fileOperation.copy.titlePlural',
      titleParams: { count: 2 },
      confirmLabelKey: 'ui.copy',
    })
  })
})
