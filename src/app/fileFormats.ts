import type { SessionType } from '@/types/session'

export type FileFormatViewMode =
  'text' | 'table' | 'hex' | 'picture' | 'registry' | 'media' | 'version' | 'patch' | 'archive'

export interface FileFormatMatcher {
  extensions: string[]
  fileNames: string[]
  globs: string[]
}

export interface FileFormatRuleRefs {
  grammar: string
  ignore: string[]
  conversion: string
}

export interface FileFormatDefinition {
  id: string
  name: string
  priority: number
  defaultView: FileFormatViewMode
  matcher: FileFormatMatcher
  rules: FileFormatRuleRefs
  /** When false, association is skipped by matchFileFormat / session routing. */
  enabled?: boolean
}

/** Built-in format ids surfaced as association toggles in Options → Formats. */
export const optionsFormatAssociationIds = [
  'images',
  'media',
  'source-code',
  'csv',
  'registry',
  'version',
] as const

export type OptionsFormatAssociationId = (typeof optionsFormatAssociationIds)[number]

export function isFileFormatEnabled(format: FileFormatDefinition): boolean {
  return format.enabled !== false
}

export const fileFormatsStorageKey = 'open-diff-file-formats'

export const builtInFileFormats: FileFormatDefinition[] = [
  {
    id: 'plain-text',
    name: 'Plain Text',
    priority: 10,
    defaultView: 'text',
    matcher: {
      extensions: ['txt', 'text', 'log', 'md', 'json', 'yml', 'yaml', 'toml', 'ini', 'cfg'],
      fileNames: ['README', 'LICENSE'],
      globs: ['*.env.*'],
    },
    rules: {
      grammar: 'plain-text',
      ignore: ['whitespace-trim'],
      conversion: '',
    },
  },
  {
    id: 'source-code',
    name: 'Source Code',
    priority: 70,
    defaultView: 'text',
    matcher: {
      extensions: ['ts', 'tsx', 'js', 'jsx', 'vue', 'css', 'html', 'xml'],
      fileNames: [],
      globs: [],
    },
    rules: {
      grammar: 'source',
      ignore: ['comments'],
      conversion: '',
    },
  },
  {
    id: 'rust',
    name: 'Rust Source',
    priority: 80,
    defaultView: 'text',
    matcher: {
      extensions: ['rs'],
      fileNames: ['Cargo.toml', 'Cargo.lock'],
      globs: ['**/src-tauri/**/*.rs'],
    },
    rules: {
      grammar: 'rust-grammar',
      ignore: ['comments', 'formatting'],
      conversion: '',
    },
  },
  {
    id: 'csv',
    name: 'Delimited Table',
    priority: 80,
    defaultView: 'table',
    matcher: {
      extensions: ['csv', 'tsv', 'tab', 'xlsx', 'xls'],
      fileNames: [],
      globs: [],
    },
    rules: {
      grammar: '',
      ignore: ['empty-trailing-columns'],
      conversion: 'table-delimiter',
    },
  },
  {
    id: 'images',
    name: 'Pictures',
    priority: 75,
    defaultView: 'picture',
    matcher: {
      extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff'],
      fileNames: [],
      globs: [],
    },
    rules: {
      grammar: '',
      ignore: [],
      conversion: '',
    },
  },
  {
    id: 'registry',
    name: 'Registry Export',
    priority: 85,
    defaultView: 'registry',
    matcher: {
      extensions: ['reg'],
      fileNames: [],
      globs: [],
    },
    rules: {
      grammar: '',
      ignore: [],
      conversion: '',
    },
  },
  {
    id: 'patch',
    name: 'Unified Patch',
    priority: 90,
    defaultView: 'patch',
    matcher: {
      extensions: ['diff', 'patch'],
      fileNames: [],
      globs: [],
    },
    rules: {
      grammar: '',
      ignore: [],
      conversion: '',
    },
  },
  {
    id: 'media',
    name: 'Media Tags',
    priority: 72,
    defaultView: 'media',
    matcher: {
      extensions: ['mp3', 'flac', 'ogg', 'oga', 'm4a', 'mp4', 'wav', 'aac'],
      fileNames: [],
      globs: [],
    },
    rules: {
      grammar: '',
      ignore: [],
      conversion: '',
    },
  },
  {
    id: 'version',
    name: 'Version Resources',
    priority: 65,
    defaultView: 'version',
    matcher: {
      extensions: ['exe', 'dll', 'sys'],
      fileNames: [],
      globs: [],
    },
    rules: {
      grammar: '',
      ignore: [],
      conversion: '',
    },
  },
  {
    id: 'zip-archive',
    name: 'ZIP Archive',
    priority: 88,
    defaultView: 'archive',
    matcher: {
      extensions: ['zip'],
      fileNames: [],
      globs: [],
    },
    rules: {
      grammar: '',
      ignore: [],
      conversion: '',
    },
  },
  {
    id: 'tar-archive',
    name: 'TAR Archive',
    priority: 87,
    defaultView: 'archive',
    matcher: {
      extensions: ['tar', 'tgz', 'gz'],
      fileNames: [],
      globs: ['*.tar.gz'],
    },
    rules: {
      grammar: '',
      ignore: [],
      conversion: '',
    },
  },
]

const viewToSessionType: Record<FileFormatViewMode, SessionType> = {
  text: 'text-compare',
  table: 'table-compare',
  hex: 'hex-compare',
  picture: 'picture-compare',
  registry: 'registry-compare',
  media: 'media-compare',
  version: 'version-compare',
  patch: 'text-patch',
  archive: 'archive-compare',
}

export function loadFileFormats(): FileFormatDefinition[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(fileFormatsStorageKey) ?? 'null') as unknown

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return cloneFormats(builtInFileFormats)
    }

    const formats = parsed.filter(isFileFormatDefinition)

    return formats.length > 0 ? formats : cloneFormats(builtInFileFormats)
  } catch {
    return cloneFormats(builtInFileFormats)
  }
}

export function saveFileFormats(formats: FileFormatDefinition[]): void {
  localStorage.setItem(fileFormatsStorageKey, JSON.stringify(formats))
}

export function setFileFormatEnabled(
  formats: FileFormatDefinition[],
  id: string,
  enabled: boolean,
): FileFormatDefinition[] {
  const next = formats.map((format) => (format.id === id ? { ...format, enabled } : format))

  saveFileFormats(next)

  return next
}

export function matchFileFormat(
  path: string,
  formats: FileFormatDefinition[] = loadFileFormats(),
): FileFormatDefinition | undefined {
  const displayName = fileNameOf(path)
  const extension = extensionOf(path)

  return [...formats]
    .filter(isFileFormatEnabled)
    .sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name))
    .find((format) => {
      if (extension && format.matcher.extensions.includes(extension)) {
        return true
      }

      if (
        format.matcher.fileNames.some((name) => name.toLowerCase() === displayName.toLowerCase())
      ) {
        return true
      }

      return format.matcher.globs.some((glob) => matchesGlob(path, glob))
    })
}

export function sessionTypeForPath(path: string): SessionType {
  const format = matchFileFormat(path)

  if (format) {
    return viewToSessionType[format.defaultView]
  }

  return 'hex-compare'
}

export function fileNameOf(path: string): string {
  return path.replaceAll('\\', '/').split('/').at(-1) ?? path
}

export function extensionOf(path: string): string | undefined {
  const displayName = fileNameOf(path)
  const index = displayName.lastIndexOf('.')

  if (index < 0 || index === displayName.length - 1) {
    return undefined
  }

  return displayName.slice(index + 1).toLowerCase()
}

function matchesGlob(path: string, glob: string): boolean {
  const normalized = path.replaceAll('\\', '/')
  const escaped = glob
    .replaceAll(/[.+^${}()|[\]\\]/gu, '\\$&')
    .replaceAll('**', '.*')
    .replaceAll('*', '[^/]*')

  return (
    new RegExp(`^${escaped}$`, 'u').test(normalized) ||
    new RegExp(`${escaped}$`, 'u').test(normalized)
  )
}

function isFileFormatDefinition(value: unknown): value is FileFormatDefinition {
  if (!value || typeof value !== 'object') {
    return false
  }

  const format = value as {
    id?: unknown
    name?: unknown
    priority?: unknown
    defaultView?: unknown
    matcher?: { extensions?: unknown }
  }

  return (
    typeof format.id === 'string' &&
    typeof format.name === 'string' &&
    typeof format.priority === 'number' &&
    typeof format.defaultView === 'string' &&
    Array.isArray(format.matcher?.extensions)
  )
}

function cloneFormats(formats: FileFormatDefinition[]): FileFormatDefinition[] {
  return formats.map((format) => ({
    ...format,
    enabled: format.enabled !== false,
    matcher: {
      extensions: [...format.matcher.extensions],
      fileNames: [...format.matcher.fileNames],
      globs: [...format.matcher.globs],
    },
    rules: {
      ...format.rules,
      ignore: [...format.rules.ignore],
    },
  }))
}
