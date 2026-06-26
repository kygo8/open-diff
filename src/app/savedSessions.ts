import type { SessionDocument } from '@/types/session'

export interface SavedSessionFolderNode {
  kind: 'folder'
  id: string
  name: string
  children: SavedSessionTreeNode[]
}

export interface SavedSessionLeafNode {
  kind: 'session'
  id: string
  name: string
  session: SessionDocument
}

export type SavedSessionTreeNode = SavedSessionFolderNode | SavedSessionLeafNode

export const sampleSavedSessions: SessionDocument[] = [
  {
    id: 'sample-text',
    name: 'Compare sample text',
    sessionType: 'text-compare',
    locations: {
      left: { uri: 'examples/left.txt', readOnly: false },
      right: { uri: 'examples/right.txt', readOnly: false },
    },
    view: {
      layout: 'side-by-side',
      showEqual: true,
      showDifferent: true,
      showUnimportant: true,
      contextLines: 3,
    },
    rules: { filters: [], comparison: {} },
    metadata: {
      folder: 'Work/Text',
      locked: false,
      dirty: false,
      autoSaved: false,
      shared: false,
    },
  },
  {
    id: 'sample-folder',
    name: 'Review release folder',
    sessionType: 'folder-compare',
    locations: {
      left: { uri: 'releases/current', readOnly: false },
      right: { uri: 'releases/next', readOnly: false },
    },
    view: {
      layout: 'side-by-side',
      showEqual: true,
      showDifferent: true,
      showUnimportant: true,
      contextLines: 3,
    },
    rules: { filters: [], comparison: {} },
    metadata: {
      folder: 'Work/Folders',
      locked: false,
      dirty: false,
      autoSaved: false,
      shared: false,
    },
  },
]

export function buildSavedSessionTree(sessions: SessionDocument[]): SavedSessionTreeNode[] {
  const roots: SavedSessionTreeNode[] = []

  for (const session of sessions) {
    const folderPath = session.metadata.folder
    const leaf: SavedSessionLeafNode = {
      kind: 'session',
      id: session.id,
      name: session.name,
      session,
    }

    if (!folderPath) {
      roots.push(leaf)
      continue
    }

    const parent = ensureFolderPath(roots, folderPath)

    parent.children.push(leaf)
  }

  return sortTree(roots)
}

function ensureFolderPath(
  roots: SavedSessionTreeNode[],
  folderPath: string,
): SavedSessionFolderNode {
  let currentChildren = roots
  let currentFolder: SavedSessionFolderNode | undefined

  for (const segment of folderPath.split(/[\\/]/u).filter(Boolean)) {
    const existing = currentChildren.find(
      (node): node is SavedSessionFolderNode => node.kind === 'folder' && node.name === segment,
    )

    if (existing) {
      currentFolder = existing
      currentChildren = existing.children
      continue
    }

    const folder: SavedSessionFolderNode = {
      kind: 'folder',
      id: `folder:${folderPath}:${segment}:${String(currentChildren.length)}`,
      name: segment,
      children: [],
    }

    currentChildren.push(folder)
    currentFolder = folder
    currentChildren = folder.children
  }

  if (!currentFolder) {
    throw new Error('folder path must contain at least one segment')
  }

  return currentFolder
}

function sortTree(nodes: SavedSessionTreeNode[]): SavedSessionTreeNode[] {
  return nodes
    .map((node) => (node.kind === 'folder' ? { ...node, children: sortTree(node.children) } : node))
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === 'folder' ? -1 : 1
      }

      return left.name.localeCompare(right.name)
    })
}
