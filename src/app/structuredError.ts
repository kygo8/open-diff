export type StructuredOperation = 'delete' | 'overwrite' | 'copy' | 'read' | 'write'

export interface FileOperationErrorInput {
  operation: StructuredOperation
  path: string
  reason: string
  suggestion?: string
}

export interface StructuredFileOperationError {
  operation: StructuredOperation
  path: string
  reason: string
  suggestion: string
}

export function createFileOperationError(
  input: FileOperationErrorInput,
): StructuredFileOperationError {
  return {
    operation: input.operation,
    path: input.path,
    reason: input.reason,
    suggestion: input.suggestion ?? 'Check file permissions and try again.',
  }
}
