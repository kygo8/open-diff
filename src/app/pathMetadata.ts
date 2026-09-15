/** Capture-aligned path footer metadata (size / modified date). */

export interface PathFileStampLike {
  size: number
  modifiedAtMs: number
}

export function formatPathModifiedAt(modifiedAtMs: number | undefined | null): string {
  if (!modifiedAtMs) {
    return ''
  }

  const date = new Date(modifiedAtMs)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day} ${hours}:${minutes}`
}

/** English fallback used by unit helpers; views prefer i18n wrappers. */
export function formatPathFileMetadata(stamp: PathFileStampLike | null | undefined): string {
  if (!stamp) {
    return ''
  }

  const modified = formatPathModifiedAt(stamp.modifiedAtMs)
  const sizePart = `${String(stamp.size)} bytes`

  return modified ? `${sizePart}, ${modified}` : sizePart
}
