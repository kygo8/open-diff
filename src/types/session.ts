export const sessionTypes = [
  'folder-compare',
  'folder-merge',
  'folder-sync',
  'text-compare',
  'text-merge',
  'table-compare',
  'hex-compare',
  'picture-compare',
  'registry-compare',
  'text-edit',
  'text-patch',
  'clipboard-compare',
  'media-compare',
  'version-compare',
] as const

export type SessionType = (typeof sessionTypes)[number]

export type SessionLayout = 'side-by-side' | 'stacked'

export interface SessionDocument {
  id: string
  name: string
  sessionType: SessionType
  locations: SessionLocations
  view: SessionViewState
  rules: SessionRules
  metadata: SessionMetadata
}

export interface SessionLocations {
  left?: SessionLocation
  right?: SessionLocation
  center?: SessionLocation
  output?: SessionLocation
}

export interface SessionLocation {
  uri: string
  displayName?: string
  readOnly: boolean
}

export interface SessionViewState {
  layout: SessionLayout
  showEqual: boolean
  showDifferent: boolean
  showUnimportant: boolean
  contextLines: number
  selectedPath?: string
  scrollAnchor?: string
}

export interface SessionRules {
  fileFormatId?: string
  profileId?: string
  filters: string[]
  comparison: Record<string, string>
}

export interface SessionMetadata {
  description?: string
  folder?: string
  locked: boolean
  dirty: boolean
  autoSaved: boolean
  shared: boolean
  createdAt?: string
  updatedAt?: string
  lastOpenedAt?: string
}

export function isSessionType(value: string): value is SessionType {
  return sessionTypes.includes(value as SessionType)
}

export function createLocalSessionLocation(uri: string): SessionLocation {
  return {
    uri,
    readOnly: false,
  }
}

export function createDefaultSessionViewState(): SessionViewState {
  return {
    layout: 'side-by-side',
    showEqual: true,
    showDifferent: true,
    showUnimportant: true,
    contextLines: 3,
  }
}

export function createDefaultSessionMetadata(): SessionMetadata {
  return {
    locked: false,
    dirty: false,
    autoSaved: false,
    shared: false,
  }
}
