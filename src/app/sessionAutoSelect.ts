import { sessionCatalog } from '@/app/sessionCatalog'
import type { ValidDropClassification } from '@/app/dropInput'
import type { SessionType } from '@/types/session'

export interface SessionSelection {
  sessionType: SessionType
  title: string
  enabled: boolean
  route?: string
}

const textExtensions = new Set([
  'cfg',
  'css',
  'csv',
  'diff',
  'html',
  'ini',
  'js',
  'json',
  'jsx',
  'log',
  'md',
  'patch',
  'rs',
  'toml',
  'ts',
  'tsx',
  'txt',
  'vue',
  'xml',
  'yaml',
  'yml',
])

const imageExtensions = new Set(['bmp', 'gif', 'jpeg', 'jpg', 'png', 'tif', 'tiff', 'webp'])

export function selectSessionForDrop(drop: ValidDropClassification): SessionSelection {
  if (drop.kind === 'folders') {
    return selectionFor('folder-compare')
  }

  if (drop.kind === 'mixed') {
    return selectionFor('hex-compare')
  }

  const extensions = [extensionOf(drop.left.path), extensionOf(drop.right.path)]

  if (extensions.every((extension) => extension && textExtensions.has(extension))) {
    return selectionFor('text-compare')
  }

  if (extensions.every((extension) => extension && imageExtensions.has(extension))) {
    return selectionFor('picture-compare')
  }

  return selectionFor('hex-compare')
}

function selectionFor(sessionType: SessionType): SessionSelection {
  const entry = sessionCatalog.find((item) => item.type === sessionType)

  if (!entry) {
    return { sessionType, title: sessionType, enabled: false }
  }

  return {
    sessionType: entry.type,
    title: entry.title,
    enabled: entry.implemented,
    route: entry.route,
  }
}

function extensionOf(path: string): string | undefined {
  const displayName = path.replaceAll('\\', '/').split('/').at(-1) ?? path
  const index = displayName.lastIndexOf('.')

  if (index < 0 || index === displayName.length - 1) {
    return undefined
  }

  return displayName.slice(index + 1).toLowerCase()
}
