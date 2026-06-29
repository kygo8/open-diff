import { defineStore } from 'pinia'
import { ref } from 'vue'
import { workspacesStorageKey } from '@/app/sessionPersistence'
import type { WorkspaceTabsSnapshot } from '@/stores/tabs'

export interface WorkspaceDocument {
  id: string
  name: string
  tabs: WorkspaceTabsSnapshot
  createdAt: string
  updatedAt: string
}

export const useWorkspacesStore = defineStore('workspaces', () => {
  const workspaces = ref<WorkspaceDocument[]>(loadWorkspaces())

  function saveWorkspace(name: string, tabs: WorkspaceTabsSnapshot): WorkspaceDocument {
    const now = new Date().toISOString()
    const workspace: WorkspaceDocument = {
      id: crypto.randomUUID(),
      name,
      tabs: cloneSnapshot(tabs),
      createdAt: now,
      updatedAt: now,
    }

    workspaces.value = [workspace, ...workspaces.value]
    persist()

    return workspace
  }

  function renameWorkspace(id: string, name: string): boolean {
    const workspace = workspaces.value.find((item) => item.id === id)

    if (!workspace) {
      return false
    }

    workspace.name = name
    workspace.updatedAt = new Date().toISOString()
    persist()

    return true
  }

  function deleteWorkspace(id: string): boolean {
    const before = workspaces.value.length

    workspaces.value = workspaces.value.filter((workspace) => workspace.id !== id)
    persist()

    return workspaces.value.length !== before
  }

  function persist(): void {
    localStorage.setItem(workspacesStorageKey, JSON.stringify(workspaces.value))
  }

  return { workspaces, saveWorkspace, renameWorkspace, deleteWorkspace }
})

function loadWorkspaces(): WorkspaceDocument[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(workspacesStorageKey) ?? '[]') as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isWorkspaceDocument).map((workspace) => ({
      ...workspace,
      tabs: cloneSnapshot(workspace.tabs),
    }))
  } catch {
    return []
  }
}

function isWorkspaceDocument(value: unknown): value is WorkspaceDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'tabs' in value &&
    'createdAt' in value &&
    'updatedAt' in value
  )
}

function cloneSnapshot(snapshot: WorkspaceTabsSnapshot): WorkspaceTabsSnapshot {
  return {
    activeTabId: snapshot.activeTabId,
    tabs: snapshot.tabs.map((tab) => ({ ...tab })),
  }
}
