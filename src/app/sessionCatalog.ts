import type { SessionType } from '@/types/session'

export type SessionPriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface SessionCatalogEntry {
  type: SessionType
  title: string
  summary: string
  priority: SessionPriority
  implemented: boolean
  route?: string
}

export const sessionCatalog: SessionCatalogEntry[] = [
  {
    type: 'text-compare',
    title: 'Text Compare',
    summary: 'Side-by-side text diff',
    priority: 'P0',
    implemented: true,
    route: '/compare/text',
  },
  {
    type: 'folder-compare',
    title: 'Folder Compare',
    summary: 'Directory tree diff',
    priority: 'P0',
    implemented: true,
    route: '/compare/folder',
  },
  {
    type: 'folder-sync',
    title: 'Folder Sync',
    summary: 'Two-way folder operations',
    priority: 'P1',
    implemented: true,
    route: '/sync/folder',
  },
  {
    type: 'text-merge',
    title: 'Text Merge',
    summary: 'Three-way text merge',
    priority: 'P1',
    implemented: false,
  },
  {
    type: 'table-compare',
    title: 'Table Compare',
    summary: 'Delimited and spreadsheet data',
    priority: 'P1',
    implemented: false,
  },
  {
    type: 'hex-compare',
    title: 'Hex Compare',
    summary: 'Binary byte comparison',
    priority: 'P1',
    implemented: false,
  },
  {
    type: 'picture-compare',
    title: 'Picture Compare',
    summary: 'Image visual comparison',
    priority: 'P1',
    implemented: false,
  },
  {
    type: 'folder-merge',
    title: 'Folder Merge',
    summary: 'Three-way folder merge',
    priority: 'P2',
    implemented: false,
  },
  {
    type: 'text-edit',
    title: 'Text Edit',
    summary: 'Single-pane editor',
    priority: 'P2',
    implemented: false,
  },
  {
    type: 'text-patch',
    title: 'Text Patch',
    summary: 'Unified patch review',
    priority: 'P2',
    implemented: false,
  },
  {
    type: 'registry-compare',
    title: 'Registry Compare',
    summary: 'Registry and .reg diff',
    priority: 'P3',
    implemented: false,
  },
  {
    type: 'media-compare',
    title: 'Media Compare',
    summary: 'Audio and video metadata',
    priority: 'P3',
    implemented: false,
  },
  {
    type: 'version-compare',
    title: 'Version Compare',
    summary: 'Executable version resources',
    priority: 'P3',
    implemented: false,
  },
]

export const sessionPriorities: SessionPriority[] = ['P0', 'P1', 'P2', 'P3']
