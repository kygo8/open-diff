import {
  createDefaultSessionMetadata,
  createDefaultSessionViewState,
  type SessionDocument,
  type SessionLocation,
  type SessionType,
} from '@/types/session'
import type { SessionLaunchLocation, SessionLaunchPayload } from '@/types/sessionLaunch'

const sessionTitleByType: Record<SessionType, string> = {
  'clipboard-compare': 'Clipboard Compare',
  'folder-compare': 'Folder Compare',
  'folder-merge': 'Folder Merge',
  'folder-sync': 'Folder Sync',
  'hex-compare': 'Hex Compare',
  'media-compare': 'Media Compare',
  'picture-compare': 'Picture Compare',
  'registry-compare': 'Registry Compare',
  'table-compare': 'Table Compare',
  'text-compare': 'Text Compare',
  'text-edit': 'Text Edit',
  'text-merge': 'Text Merge',
  'text-patch': 'Text Patch',
  'version-compare': 'Version Compare',
}

export function createSessionFromLaunch(payload: SessionLaunchPayload): SessionDocument {
  return {
    id: crypto.randomUUID(),
    name: payload.title,
    sessionType: payload.sessionType,
    locations: {
      left: toSessionLocation(payload.locations.left),
      right: toSessionLocation(payload.locations.right),
      center: toSessionLocation(payload.locations.center),
      output: toSessionLocation(payload.locations.output),
    },
    view: createDefaultSessionViewState(),
    rules: { filters: [], comparison: {} },
    metadata: timestampMetadata(),
  }
}

export function createUntitledSession(sessionType: SessionType): SessionDocument {
  return {
    id: crypto.randomUUID(),
    name: `Untitled ${sessionTitleByType[sessionType]}`,
    sessionType,
    locations: {},
    view: createDefaultSessionViewState(),
    rules: { filters: [], comparison: {} },
    metadata: timestampMetadata(),
  }
}

function toSessionLocation(
  location: SessionLaunchLocation | undefined,
): SessionLocation | undefined {
  if (!location) {
    return undefined
  }

  return {
    uri: location.uri,
    displayName: location.displayName,
    readOnly: location.readOnly,
  }
}

function timestampMetadata(): SessionDocument['metadata'] {
  const now = new Date().toISOString()

  return {
    ...createDefaultSessionMetadata(),
    createdAt: now,
    updatedAt: now,
  }
}
