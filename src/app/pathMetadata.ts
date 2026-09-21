/** Capture-aligned path footer metadata (size / modified / encoding). */

export interface PathFileStampLike {
  size: number
  modifiedAtMs: number
}

export interface PathDateFormatOptions {
  showMilliseconds?: boolean
  /** Capture footers use YYYY/M/D H:mm:ss (slash, with seconds). */
  captureStyle?: boolean
}

export interface PathFooterMeta {
  modified: string
  sizeLabel: string
  formatLabel?: string
  encoding?: string
  lineEnding?: string
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
  const month = String(date.getMonth() + 1)
  const day = String(date.getDate())
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  if (options.captureStyle) {
    const seconds = String(date.getSeconds()).padStart(2, '0')
    const base = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`

    if (!options.showMilliseconds) {
      return base
    }

    const millis = String(date.getMilliseconds()).padStart(3, '0')

    return `${base}.${millis}`
  }

  const paddedMonth = month.padStart(2, '0')
  const paddedDay = day.padStart(2, '0')
  const base = `${year}-${paddedMonth}-${paddedDay} ${hours}:${minutes}`

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

export function buildPathFooterMeta(
  stamp: PathFileStampLike | null | undefined,
  extras: {
    formatLabel?: string
    encoding?: string
    lineEnding?: string
    showMilliseconds?: boolean
  } = {},
): PathFooterMeta | null {
  if (!stamp) {
    return null
  }

  return {
    modified: formatPathModifiedAt(stamp.modifiedAtMs, {
      captureStyle: true,
      showMilliseconds: extras.showMilliseconds,
    }),
    sizeLabel: `${String(stamp.size)} bytes`,
    formatLabel: extras.formatLabel,
    encoding: extras.encoding,
    lineEnding: extras.lineEnding,
  }
}
