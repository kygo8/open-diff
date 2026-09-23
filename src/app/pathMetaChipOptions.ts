/** Capture-aligned path footer chip option lists (format / encoding). */

export const defaultPathEncodings = [
  'UTF-8',
  'UTF-16 LE',
  'UTF-16 BE',
  'GBK',
  'Windows-1252',
  'ASCII',
] as const

export interface PathMetaChipOption {
  id: string
  label: string
}

/** Ensure the active label stays selectable even when not in the provided list. */
export function resolvePathMetaChipOptions(
  options: readonly PathMetaChipOption[] | readonly string[] | undefined,
  activeLabel: string | undefined,
  fallback: readonly string[] = [],
): PathMetaChipOption[] {
  const source =
    options && options.length > 0 ? options : fallback.map((label) => ({ id: label, label }))

  const normalized: PathMetaChipOption[] = source.map((item) =>
    typeof item === 'string' ? { id: item, label: item } : { id: item.id, label: item.label },
  )

  if (activeLabel && !normalized.some((item) => item.label === activeLabel)) {
    return [{ id: activeLabel, label: activeLabel }, ...normalized]
  }

  return normalized
}
