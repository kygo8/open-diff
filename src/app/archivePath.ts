/** Match archive-core::is_archive_path for ZIP/TAR/7z sides in Folder Compare. */

const ARCHIVE_SUFFIXES = ['.tar.gz', '.tgz', '.zip', '.tar', '.gz', '.7z'] as const

export function isArchivePath(path: string): boolean {
  const lower = path.trim().replaceAll('\\', '/').toLowerCase()

  if (!lower) {
    return false
  }

  return ARCHIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix))
}

export function archiveSideLabel(path: string): 'archive' | 'folder' {
  return isArchivePath(path) ? 'archive' : 'folder'
}
