/** Match archive-core::is_archive_path for ZIP/TAR/7z sides in Folder Compare. */

export const DEFAULT_ARCHIVE_SUFFIXES = ['.tar.gz', '.tgz', '.zip', '.tar', '.gz', '.7z'] as const

export const archiveExtensionsStorageKey = 'open-diff-archive-extensions'

let archiveSuffixes: string[] = [...DEFAULT_ARCHIVE_SUFFIXES]

export function normalizeArchiveSuffix(value: string): string | null {
  const trimmed = value.trim().toLowerCase()

  if (!trimmed) {
    return null
  }

  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
}

export function loadArchiveSuffixes(): string[] {
  try {
    const raw = localStorage.getItem(archiveExtensionsStorageKey)

    if (!raw) {
      return [...DEFAULT_ARCHIVE_SUFFIXES]
    }

    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) {
      return [...DEFAULT_ARCHIVE_SUFFIXES]
    }

    const normalized = normalizeArchiveSuffixList(parsed)

    return normalized.length > 0 ? normalized : [...DEFAULT_ARCHIVE_SUFFIXES]
  } catch {
    return [...DEFAULT_ARCHIVE_SUFFIXES]
  }
}

export function normalizeArchiveSuffixList(values: unknown[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') {
      continue
    }

    const suffix = normalizeArchiveSuffix(value)

    if (!suffix || seen.has(suffix)) {
      continue
    }

    seen.add(suffix)
    result.push(suffix)
  }

  // Keep longer compound suffixes first so .tar.gz wins over .gz.
  return result.sort((left, right) => {
    if (right.length !== left.length) {
      return right.length - left.length
    }

    if (left < right) {
      return -1
    }

    if (left > right) {
      return 1
    }

    return 0
  })
}

export function getArchiveSuffixes(): string[] {
  return [...archiveSuffixes]
}

export function setArchiveSuffixes(values: string[]): string[] {
  const normalized = normalizeArchiveSuffixList(values)

  archiveSuffixes = normalized.length > 0 ? normalized : [...DEFAULT_ARCHIVE_SUFFIXES]

  localStorage.setItem(archiveExtensionsStorageKey, JSON.stringify(archiveSuffixes))

  return getArchiveSuffixes()
}

export function resetArchiveSuffixes(): string[] {
  return setArchiveSuffixes([...DEFAULT_ARCHIVE_SUFFIXES])
}

export function parseArchiveSuffixesInput(raw: string): string[] {
  return normalizeArchiveSuffixList(raw.split(/[\s,;]+/))
}

export function formatArchiveSuffixesInput(suffixes: string[] = getArchiveSuffixes()): string {
  return suffixes.join(', ')
}

export function isArchivePath(path: string): boolean {
  const lower = path.trim().replaceAll('\\', '/').toLowerCase()

  if (!lower) {
    return false
  }

  return archiveSuffixes.some((suffix) => lower.endsWith(suffix))
}

export function archiveSideLabel(path: string): 'archive' | 'folder' {
  return isArchivePath(path) ? 'archive' : 'folder'
}

archiveSuffixes = loadArchiveSuffixes()
