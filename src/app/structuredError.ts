export type StructuredOperation = 'delete' | 'overwrite' | 'copy' | 'read' | 'write'
export type AppErrorCode =
  | 'app.unknown'
  | 'file.notFound'
  | 'file.readFailed'
  | 'file.writeFailed'
  | 'file.unsupportedEncoding'

export interface AppErrorPayload {
  code: AppErrorCode
  messageKey: string
  params?: Record<string, string | number>
  debugMessage: string
  suggestionKey?: string
}

export interface LocalizedAppError {
  code: AppErrorCode
  title: string
  message: string
  suggestion: string
  debugMessage: string
}

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

export function resolveLocalizedAppError(
  error: AppErrorPayload,
  t: (key: string, params?: Record<string, string | number>) => string,
): LocalizedAppError {
  const params = error.params ?? {}
  const fallbackSuggestionKey = `error.${error.code}.suggestion`
  const suggestionKey = error.suggestionKey ?? fallbackSuggestionKey
  const suggestion = t(suggestionKey, params)

  return {
    code: error.code,
    title: t(`error.${error.code}.title`),
    message: t(error.messageKey, params),
    suggestion: !error.suggestionKey && suggestion === fallbackSuggestionKey ? '' : suggestion,
    debugMessage: error.debugMessage,
  }
}
