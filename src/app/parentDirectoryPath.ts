/** Parent directory of a filesystem or URI-ish path (honest no-op at roots). */

export function parentDirectoryPath(path: string): string | undefined {
  const trimmed = path.trim()

  if (!trimmed) {
    return undefined
  }

  const normalized = trimmed.replace(/[/\\]+$/u, '')

  if (!normalized || normalized === '/' || /^[A-Za-z]:$/u.test(normalized)) {
    return undefined
  }

  const remoteMatch = /^(remote:\/\/[^/]+)(\/.*)$/u.exec(normalized)

  if (remoteMatch) {
    const remotePath = remoteMatch[2]

    if (!remotePath) {
      return undefined
    }

    const remoteParent = parentDirectoryPath(remotePath)

    if (!remoteParent || remoteParent === '/') {
      return undefined
    }

    return `${remoteMatch[1]}${remoteParent}`
  }

  const separatorIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'))

  if (separatorIndex < 0) {
    return undefined
  }

  if (separatorIndex === 0) {
    return '/'
  }

  const parent = normalized.slice(0, separatorIndex)

  if (/^[A-Za-z]:$/u.test(parent)) {
    return undefined
  }

  return parent || undefined
}
