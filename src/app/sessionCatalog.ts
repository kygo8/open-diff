import type { SessionType } from '@/types/session'

export type SessionPriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface SessionCatalogEntry {
  type: SessionType
  title: string
  titleKey: string
  summary: string
  summaryKey: string
  priority: SessionPriority
  implemented: boolean
  route?: string
}

export const sessionCatalog: SessionCatalogEntry[] = [
  {
    type: 'text-compare',
    title: 'Text Compare',
    titleKey: 'ui.textCompare',
    summary: 'Side-by-side text diff',
    summaryKey: 'session.summary.textCompare',
    priority: 'P0',
    implemented: true,
    route: '/compare/text',
  },
  {
    type: 'folder-compare',
    title: 'Folder Compare',
    titleKey: 'ui.folderCompare',
    summary: 'Directory tree diff',
    summaryKey: 'session.summary.folderCompare',
    priority: 'P0',
    implemented: true,
    route: '/compare/folder',
  },
  {
    type: 'folder-sync',
    title: 'Folder Sync',
    titleKey: 'ui.folderSync',
    summary: 'Two-way folder operations',
    summaryKey: 'session.summary.folderSync',
    priority: 'P1',
    implemented: true,
    route: '/sync/folder',
  },
  {
    type: 'text-merge',
    title: 'Text Merge',
    titleKey: 'ui.textMerge',
    summary: 'Three-way text merge',
    summaryKey: 'session.summary.textMerge',
    priority: 'P1',
    implemented: true,
    route: '/merge/text',
  },
  {
    type: 'table-compare',
    title: 'Table Compare',
    titleKey: 'ui.tableCompare',
    summary: 'Delimited and spreadsheet data',
    summaryKey: 'session.summary.tableCompare',
    priority: 'P1',
    implemented: true,
    route: '/compare/table',
  },
  {
    type: 'hex-compare',
    title: 'Hex Compare',
    titleKey: 'ui.hexCompare',
    summary: 'Binary byte comparison',
    summaryKey: 'session.summary.hexCompare',
    priority: 'P1',
    implemented: true,
    route: '/compare/hex',
  },
  {
    type: 'picture-compare',
    title: 'Picture Compare',
    titleKey: 'ui.pictureCompare',
    summary: 'Image visual comparison',
    summaryKey: 'session.summary.pictureCompare',
    priority: 'P1',
    implemented: true,
    route: '/compare/picture',
  },
  {
    type: 'folder-merge',
    title: 'Folder Merge',
    titleKey: 'ui.folderMerge',
    summary: 'Three-way folder merge',
    summaryKey: 'session.summary.folderMerge',
    priority: 'P2',
    implemented: true,
    route: '/merge/folder',
  },
  {
    type: 'text-edit',
    title: 'Text Edit',
    titleKey: 'ui.textEdit',
    summary: 'Single-pane editor',
    summaryKey: 'session.summary.textEdit',
    priority: 'P2',
    implemented: true,
    route: '/edit/text',
  },
  {
    type: 'text-patch',
    title: 'Text Patch',
    titleKey: 'ui.textPatch',
    summary: 'Unified patch review',
    summaryKey: 'session.summary.textPatch',
    priority: 'P2',
    implemented: true,
    route: '/patch/text',
  },
  {
    type: 'clipboard-compare',
    title: 'Clipboard Compare',
    titleKey: 'ui.clipboardCompare',
    summary: 'Clipboard text history',
    summaryKey: 'session.summary.clipboardCompare',
    priority: 'P2',
    implemented: true,
    route: '/compare/clipboard',
  },
  {
    type: 'registry-compare',
    title: 'Registry Compare',
    titleKey: 'ui.registryCompare',
    summary: 'Registry and .reg diff',
    summaryKey: 'session.summary.registryCompare',
    priority: 'P3',
    implemented: true,
    route: '/compare/registry',
  },
  {
    type: 'media-compare',
    title: 'Media Compare',
    titleKey: 'ui.mediaCompare',
    summary: 'Audio and video metadata',
    summaryKey: 'session.summary.mediaCompare',
    priority: 'P3',
    implemented: true,
    route: '/compare/media',
  },
  {
    type: 'version-compare',
    title: 'Version Compare',
    titleKey: 'ui.versionCompare',
    summary: 'Executable version resources',
    summaryKey: 'session.summary.versionCompare',
    priority: 'P3',
    implemented: true,
    route: '/compare/version',
  },
]

export const sessionPriorities: SessionPriority[] = ['P0', 'P1', 'P2', 'P3']
