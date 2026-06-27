export type FileOperation = 'delete' | 'overwrite' | 'copy'
export type FileOperationRisk = 'medium' | 'high'

export interface FileOperationConfirmationRequest {
  operation: FileOperation
  paths: string[]
}

export interface FileOperationConfirmation {
  operation: FileOperation
  title: string
  risk: FileOperationRisk
  confirmLabel: string
  paths: string[]
  message: string
}

const operationCopy: Record<
  FileOperation,
  { label: string; risk: FileOperationRisk; message: string }
> = {
  delete: {
    label: 'Delete',
    risk: 'high',
    message: 'This operation can remove files or folders from disk.',
  },
  overwrite: {
    label: 'Overwrite',
    risk: 'high',
    message: 'This operation can replace existing file contents.',
  },
  copy: {
    label: 'Copy',
    risk: 'medium',
    message: 'This operation can create or replace files at the target path.',
  },
}

export function createFileOperationConfirmation(
  request: FileOperationConfirmationRequest,
): FileOperationConfirmation {
  const copy = operationCopy[request.operation]

  return {
    operation: request.operation,
    title: `${copy.label} ${String(request.paths.length)} item${request.paths.length === 1 ? '' : 's'}?`,
    risk: copy.risk,
    confirmLabel: copy.label,
    paths: [...request.paths],
    message: copy.message,
  }
}
