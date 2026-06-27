export interface ClipboardTextSource {
  kind: 'clipboard-text'
  title: string
  text: string
}

export type ClipboardSourceErrorCode =
  | 'clipboard-unavailable'
  | 'clipboard-empty'
  | 'clipboard-read-failed'

export class ClipboardSourceError extends Error {
  constructor(
    public readonly code: ClipboardSourceErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'ClipboardSourceError'
  }
}

export async function readClipboardTextSource(): Promise<ClipboardTextSource> {
  const clipboard = clipboardApi()

  if (!clipboard) {
    throw clipboardError('clipboard-unavailable', 'Clipboard text access is unavailable.')
  }

  try {
    const text = await clipboard.readText()

    if (!text) {
      throw clipboardError('clipboard-empty', 'Clipboard does not contain text.')
    }

    return {
      kind: 'clipboard-text',
      title: 'Clipboard Text',
      text,
    }
  } catch (error) {
    if (isClipboardSourceError(error)) {
      throw error
    }

    throw clipboardError('clipboard-read-failed', String(error))
  }
}

function clipboardError(code: ClipboardSourceErrorCode, message: string): ClipboardSourceError {
  return new ClipboardSourceError(code, message)
}

function isClipboardSourceError(error: unknown): error is ClipboardSourceError {
  return error instanceof ClipboardSourceError
}

function clipboardApi(): Pick<Clipboard, 'readText'> | null {
  if (typeof navigator === 'undefined') {
    return null
  }

  const clipboard = navigator.clipboard as Pick<Clipboard, 'readText'> | undefined

  return typeof clipboard?.readText === 'function' ? clipboard : null
}
