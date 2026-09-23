export const textPatchSessionOptionsStorageKey = 'open-diff-text-patch-session-options'

export interface TextPatchSessionOptions {
  /** Wrap long patch lines in the Text Patch session view. */
  wrapLongLines: boolean
}

export function defaultTextPatchSessionOptions(): TextPatchSessionOptions {
  return {
    wrapLongLines: false,
  }
}

export function loadTextPatchSessionOptions(
  storage: Pick<Storage, 'getItem'> = localStorage,
): TextPatchSessionOptions {
  try {
    const raw = storage.getItem(textPatchSessionOptionsStorageKey)

    if (!raw) {
      return defaultTextPatchSessionOptions()
    }

    const parsed = JSON.parse(raw) as Partial<TextPatchSessionOptions>

    return {
      wrapLongLines: parsed.wrapLongLines === true,
    }
  } catch {
    return defaultTextPatchSessionOptions()
  }
}

export function saveTextPatchSessionOptions(
  state: TextPatchSessionOptions,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    textPatchSessionOptionsStorageKey,
    JSON.stringify({
      wrapLongLines: state.wrapLongLines,
    }),
  )
}
