export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

function readStringField(value: object, key: string): string {
  if (!(key in value)) {
    return ''
  }

  const field = (value as Record<string, unknown>)[key]

  return typeof field === 'string' ? field : ''
}

function rawCompareErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object') {
    // Tauri/AppErrorPayload uses debugMessage (camelCase); keep snake_case fallback.
    const debugMessage =
      readStringField(error, 'debugMessage') || readStringField(error, 'debug_message')

    if (debugMessage) {
      return debugMessage
    }

    const message = readStringField(error, 'message')

    if (message) {
      return message
    }
  }

  return ''
}

/** Map raw invoke / Error / undefined into a short user-facing compare message. */
export function formatCompareError(error: unknown, t: TranslateFn): string {
  const trimmed = rawCompareErrorMessage(error).trim()

  if (!trimmed || trimmed === 'undefined' || trimmed === 'null' || trimmed === '[object Object]') {
    return t('error.compare.failed')
  }

  if (/cancel+ed|aborted/i.test(trimmed)) {
    return t('error.compare.cancelled')
  }

  if (/ENOENT|not found|os error 2|no such file/i.test(trimmed)) {
    return t('error.compare.pathMissing')
  }

  if (/EACCES|permission denied|access is denied/i.test(trimmed)) {
    return t('error.compare.permissionDenied')
  }

  if (/failed to (call|invoke)|invoke\(|tauri/i.test(trimmed) && trimmed.length > 80) {
    return t('error.compare.failed')
  }

  return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed
}
