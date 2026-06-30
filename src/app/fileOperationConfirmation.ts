export type FileOperation = 'delete' | 'overwrite' | 'copy'
export type FileOperationRisk = 'medium' | 'high'

export interface FileOperationConfirmationRequest {
  operation: FileOperation
  paths: string[]
}

export interface FileOperationConfirmation {
  operation: FileOperation
  titleKey: string
  titleParams: Record<string, string | number>
  risk: FileOperationRisk
  riskKey: string
  confirmLabelKey: string
  paths: string[]
  messageKey: string
}

const operationCopy: Record<
  FileOperation,
  { labelKey: string; risk: FileOperationRisk; messageKey: string }
> = {
  delete: {
    labelKey: 'ui.delete',
    risk: 'high',
    messageKey: 'fileOperation.delete.message',
  },
  overwrite: {
    labelKey: 'ui.overwrite',
    risk: 'high',
    messageKey: 'fileOperation.overwrite.message',
  },
  copy: {
    labelKey: 'ui.copy',
    risk: 'medium',
    messageKey: 'fileOperation.copy.message',
  },
}

export function createFileOperationConfirmation(
  request: FileOperationConfirmationRequest,
): FileOperationConfirmation {
  const copy = operationCopy[request.operation]
  const count = request.paths.length

  return {
    operation: request.operation,
    titleKey:
      count === 1
        ? `fileOperation.${request.operation}.title`
        : `fileOperation.${request.operation}.titlePlural`,
    titleParams: { count },
    risk: copy.risk,
    riskKey: `fileOperation.risk.${copy.risk}`,
    confirmLabelKey: copy.labelKey,
    paths: [...request.paths],
    messageKey: copy.messageKey,
  }
}
