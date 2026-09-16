/** Capture-aligned path footer metadata (size / modified date). */

export interface PathFileStampLike {
  size: number
  modifiedAtMs: number
}

export interface PathDateFormatOptions {
  showMilliseconds?: boolean
}

export function formatPathModifiedAt(
  modifiedAtMs: number | undefined | null,
  options: PathDateFormatOptions = {},
): string {
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
  const base = `${year}-${month}-${day} ${hours}:${minutes}`

  if (!options.showMilliseconds) {
    return base
  }

  const seconds = String(date.getSeconds()).padStart(2, '0')
  const millis = String(date.getMilliseconds()).padStart(3, '0')

  return `${base}:${seconds}.${millis}`
}

/** English fallback used by unit helpers; views prefer i18n wrappers. */
export function formatPathFileMetadata(
  stamp: PathFileStampLike | null | undefined,
  options: PathDateFormatOptions = {},
): string {
  if (!stamp) {
    return ''
  }

  const modified = formatPathModifiedAt(stamp.modifiedAtMs, options)
  const sizePart = `${String(stamp.size)} bytes`

  return modified ? `${modified} · ${sizePart}` : sizePart
}
