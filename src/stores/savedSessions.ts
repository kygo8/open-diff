import { defineStore } from 'pinia'
import { ref } from 'vue'
import { sampleSavedSessions } from '@/app/savedSessions'
import type { SessionDocument, SessionRules } from '@/types/session'

export const useSavedSessionsStore = defineStore('savedSessions', () => {
  const sessions = ref<SessionDocument[]>(cloneSessions(sampleSavedSessions))
  const pendingSavePrompt = ref<SessionDocument>()
  const recoveryCandidates = ref<SessionDocument[]>([])

  function renameSession(id: string, name: string): boolean {
    const session = findSession(id)

    if (!session || session.metadata.locked) {
      return false
    }

    session.name = name

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

    return copy
  }

  function moveSession(id: string, folder: string | undefined): boolean {
    const session = findSession(id)

    if (!session || session.metadata.locked) {
      return false
    }

    session.metadata.folder = folder

    return true
  }

  function deleteSession(id: string): boolean {
    const session = findSession(id)

    if (!session || session.metadata.locked) {
      return false
    }

    sessions.value = sessions.value.filter((session) => session.id !== id)

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

    return true
  }

  function setSessionLocked(id: string, locked: boolean): boolean {
    const session = findSession(id)

    if (!session) {
      return false
    }

    session.metadata.locked = locked

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

    return true
  }

  function markSessionSaved(id: string): boolean {
    const session = findSession(id)

    if (!session) {
      return false
    }

    session.metadata.dirty = false

    if (pendingSavePrompt.value?.id === id) {
      pendingSavePrompt.value = undefined
    }

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

  return {
    sessions,
    renameSession,
    copySession,
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
