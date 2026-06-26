import { defineStore } from 'pinia'
import { ref } from 'vue'
import { sampleSavedSessions } from '@/app/savedSessions'
import type { SessionDocument } from '@/types/session'

export const useSavedSessionsStore = defineStore('savedSessions', () => {
  const sessions = ref<SessionDocument[]>(cloneSessions(sampleSavedSessions))

  function renameSession(id: string, name: string): void {
    const session = findSession(id)

    if (!session) {
      return
    }

    session.name = name
  }

  function copySession(id: string): SessionDocument {
    const session = findSession(id)

    if (!session) {
      throw new Error(`Session ${id} was not found.`)
    }

    const copy = cloneSession(session)

    copy.id = `${session.id}-copy-${String(nextCopyIndex())}`
    copy.name = `${session.name} Copy`
    copy.metadata = { ...copy.metadata, dirty: false }
    sessions.value.push(copy)

    return copy
  }

  function moveSession(id: string, folder: string | undefined): void {
    const session = findSession(id)

    if (!session) {
      return
    }

    session.metadata.folder = folder
  }

  function deleteSession(id: string): void {
    sessions.value = sessions.value.filter((session) => session.id !== id)
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
