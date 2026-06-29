import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  loadAutoSavedSessions,
  loadNamedSessions,
  saveAutoSavedSessions,
  saveNamedSessions,
} from '@/app/sessionPersistence'
import type { SessionDocument, SessionRules } from '@/types/session'

export const useSavedSessionsStore = defineStore('savedSessions', () => {
  const sessions = ref<SessionDocument[]>(loadNamedSessions())
  const pendingSavePrompt = ref<SessionDocument>()
  const autoSavedSessions = ref<SessionDocument[]>(loadAutoSavedSessions())
  const recoveryCandidates = ref<SessionDocument[]>(
    autoSavedSessions.value.filter((session) => session.metadata.autoSaved),
  )

  function renameSession(id: string, name: string): boolean {
    const session = findSession(id)

    if (!session || session.metadata.locked) {
      return false
    }

    session.name = name
    touchSession(session)
    persistSessions()

    return true
  }

  function copySession(id: string): SessionDocument {
    const session = findSession(id)

    if (!session) {
      throw new Error(`Session ${id} was not found.`)
    }

    const copy = cloneSession(session)

    copy.id = `${session.id}-copy-${String(nextCopyIndex())}`
    copy.name = `${session.name} Copy`
    copy.metadata = { ...copy.metadata, dirty: false, locked: false }
    sessions.value.push(copy)
    persistSessions()

    return copy
  }

  function saveSharedSessionAsCopy(id: string): SessionDocument {
    const copy = copySession(id)

    copy.id = `${id}-editable-${String(nextEditableCopyIndex())}`
    copy.name = `${copy.name} Editable`
    copy.metadata = {
      ...copy.metadata,
      shared: false,
      locked: false,
      dirty: false,
    }
    copy.locations = markLocationsWritable(copy.locations)
    persistSessions()

    return copy
  }

  function moveSession(id: string, folder: string | undefined): boolean {
    const session = findSession(id)

    if (!session || session.metadata.locked) {
      return false
    }

    session.metadata.folder = folder
    touchSession(session)
    persistSessions()

    return true
  }

  function deleteSession(id: string): boolean {
    const session = findSession(id)

    if (!session || session.metadata.locked) {
      return false
    }

    sessions.value = sessions.value.filter((session) => session.id !== id)
    persistSessions()

    return true
  }

  function requestDeleteSession(id: string): boolean {
    const session = findSession(id)

    if (!session || session.metadata.locked) {
      return false
    }

    if (session.metadata.dirty) {
      pendingSavePrompt.value = cloneSession(session)

      return false
    }

    return deleteSession(id)
  }

  function overwriteSession(id: string, nextSession: SessionDocument): boolean {
    const index = sessions.value.findIndex((session) => session.id === id)

    if (index < 0 || sessions.value[index]?.metadata.locked) {
      return false
    }

    sessions.value[index] = cloneSession(nextSession)
    touchSession(sessions.value[index])
    persistSessions()

    return true
  }

  function setSessionLocked(id: string, locked: boolean): boolean {
    const session = findSession(id)

    if (!session) {
      return false
    }

    session.metadata.locked = locked
    touchSession(session)
    persistSessions()

    return true
  }

  function updateSessionRules(id: string, rules: Partial<SessionRules>): boolean {
    const session = findSession(id)

    if (!session || session.metadata.locked) {
      return false
    }

    session.rules = {
      ...session.rules,
      ...rules,
      filters: rules.filters ?? session.rules.filters,
      comparison: rules.comparison ?? session.rules.comparison,
    }
    session.metadata.dirty = true
    touchSession(session)
    persistSessions()

    return true
  }

  function markSessionSaved(id: string): boolean {
    const session = findSession(id)

    if (!session) {
      return false
    }

    session.metadata.dirty = false
    touchSession(session)

    if (pendingSavePrompt.value?.id === id) {
      pendingSavePrompt.value = undefined
    }

    persistSessions()

    return true
  }

  function detectRecoverySessions(candidates: SessionDocument[]): void {
    recoveryCandidates.value = cloneSessions(
      candidates.filter((session) => session.metadata.autoSaved),
    )
  }

  function restoreRecoverySessions(): void {
    const existingIds = new Set(sessions.value.map((session) => session.id))
    const restored = recoveryCandidates.value.filter((session) => !existingIds.has(session.id))

    sessions.value = [...sessions.value, ...cloneSessions(restored)]
    recoveryCandidates.value = []
    persistSessions()
  }

  function loadSharedSession(session: SessionDocument): void {
    const shared = cloneSession(session)

    shared.metadata = {
      ...shared.metadata,
      shared: true,
      locked: true,
      dirty: false,
    }
    shared.locations = markLocationsReadOnly(shared.locations)

    sessions.value.push(shared)
    persistSessions()
  }

  function saveSession(session: SessionDocument): SessionDocument {
    const snapshot = cloneSession(session)
    const existingIndex = sessions.value.findIndex((item) => item.id === snapshot.id)

    snapshot.metadata = {
      ...snapshot.metadata,
      dirty: false,
      updatedAt: new Date().toISOString(),
      createdAt: snapshot.metadata.createdAt ?? new Date().toISOString(),
    }

    if (existingIndex >= 0) {
      if (sessions.value[existingIndex]?.metadata.locked) {
        throw new Error(`Session ${snapshot.id} is locked.`)
      }

      sessions.value[existingIndex] = snapshot
    } else {
      sessions.value.push(snapshot)
    }

    persistSessions()

    return cloneSession(snapshot)
  }

  function saveSessionAs(id: string, name: string): SessionDocument {
    const session = findSession(id)

    if (!session) {
      throw new Error(`Session ${id} was not found.`)
    }

    const now = new Date().toISOString()
    const copy = cloneSession(session)

    copy.id = crypto.randomUUID()
    copy.name = name
    copy.metadata = {
      ...copy.metadata,
      locked: false,
      shared: false,
      dirty: false,
      createdAt: now,
      updatedAt: now,
    }
    copy.locations = markLocationsWritable(copy.locations)
    sessions.value.push(copy)
    persistSessions()

    return cloneSession(copy)
  }

  function autoSaveSession(session: SessionDocument, limit: number): void {
    const snapshot = cloneSession(session)

    snapshot.metadata = {
      ...snapshot.metadata,
      autoSaved: true,
      dirty: false,
      updatedAt: new Date().toISOString(),
    }
    autoSavedSessions.value = [
      snapshot,
      ...autoSavedSessions.value.filter((item) => item.id !== snapshot.id),
    ].slice(0, Math.max(0, limit))
    saveAutoSavedSessions(autoSavedSessions.value)
    detectRecoverySessions(autoSavedSessions.value)
  }

  function clearAutoSavedSessions(): void {
    autoSavedSessions.value = []
    recoveryCandidates.value = []
    saveAutoSavedSessions([])
  }

  function snapshot(): SessionDocument[] {
    return cloneSessions(sessions.value)
  }

  function findSession(id: string): SessionDocument | undefined {
    return sessions.value.find((session) => session.id === id)
  }

  function nextCopyIndex(): number {
    return sessions.value.filter((session) => session.id.includes('-copy-')).length + 1
  }

  function nextEditableCopyIndex(): number {
    return sessions.value.filter((session) => session.id.includes('-editable-')).length + 1
  }

  function persistSessions(): void {
    saveNamedSessions(sessions.value)
  }

  return {
    sessions,
    renameSession,
    copySession,
    saveSharedSessionAsCopy,
    moveSession,
    deleteSession,
    requestDeleteSession,
    overwriteSession,
    setSessionLocked,
    updateSessionRules,
    markSessionSaved,
    pendingSavePrompt,
    recoveryCandidates,
    detectRecoverySessions,
    restoreRecoverySessions,
    loadSharedSession,
    saveSession,
    saveSessionAs,
    autoSavedSessions,
    autoSaveSession,
    clearAutoSavedSessions,
    snapshot,
  }
})

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

function markLocationsReadOnly(
  locations: SessionDocument['locations'],
): SessionDocument['locations'] {
  return {
    left: locations.left ? { ...locations.left, readOnly: true } : undefined,
    right: locations.right ? { ...locations.right, readOnly: true } : undefined,
    center: locations.center ? { ...locations.center, readOnly: true } : undefined,
    output: locations.output ? { ...locations.output, readOnly: true } : undefined,
  }
}

function markLocationsWritable(
  locations: SessionDocument['locations'],
): SessionDocument['locations'] {
  return {
    left: locations.left ? { ...locations.left, readOnly: false } : undefined,
    right: locations.right ? { ...locations.right, readOnly: false } : undefined,
    center: locations.center ? { ...locations.center, readOnly: false } : undefined,
    output: locations.output ? { ...locations.output, readOnly: false } : undefined,
  }
}

function touchSession(session: SessionDocument): void {
  session.metadata.updatedAt = new Date().toISOString()
}
