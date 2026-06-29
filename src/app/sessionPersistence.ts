import { sampleSavedSessions } from '@/app/savedSessions'
import type { SessionDocument } from '@/types/session'

export const namedSessionsStorageKey = 'open-diff-named-sessions'
export const autoSavedSessionsStorageKey = 'open-diff-auto-saved-sessions'
export const workspacesStorageKey = 'open-diff-workspaces'

export function loadNamedSessions(): SessionDocument[] {
  return loadSessionArray(namedSessionsStorageKey, sampleSavedSessions)
}

export function saveNamedSessions(sessions: SessionDocument[]): void {
  localStorage.setItem(namedSessionsStorageKey, JSON.stringify(sessions))
}

export function loadAutoSavedSessions(): SessionDocument[] {
  return loadSessionArray(autoSavedSessionsStorageKey, [])
}

export function saveAutoSavedSessions(sessions: SessionDocument[]): void {
  localStorage.setItem(autoSavedSessionsStorageKey, JSON.stringify(sessions))
}

function loadSessionArray(key: string, fallback: SessionDocument[]): SessionDocument[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as unknown

    if (!Array.isArray(parsed)) {
      return cloneSessions(fallback)
    }

    return parsed.filter(isSessionDocument).map(cloneSession)
  } catch {
    return cloneSessions(fallback)
  }
}

function isSessionDocument(value: unknown): value is SessionDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'sessionType' in value &&
    'locations' in value &&
    'view' in value &&
    'rules' in value &&
    'metadata' in value
  )
}

function cloneSessions(sessions: SessionDocument[]): SessionDocument[] {
  return sessions.map(cloneSession)
}

function cloneSession(session: SessionDocument): SessionDocument {
  return {
    ...session,
    locations: {
      left: session.locations.left ? { ...session.locations.left } : undefined,
      right: session.locations.right ? { ...session.locations.right } : undefined,
      center: session.locations.center ? { ...session.locations.center } : undefined,
      output: session.locations.output ? { ...session.locations.output } : undefined,
    },
    view: { ...session.view },
    rules: {
      filters: [...session.rules.filters],
      comparison: { ...session.rules.comparison },
      fileFormatId: session.rules.fileFormatId,
      profileId: session.rules.profileId,
    },
    metadata: { ...session.metadata },
  }
}
