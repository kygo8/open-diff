import { describe, expect, it } from 'vitest'
import { buildSavedSessionTree } from './savedSessions'
import type { SessionDocument } from '@/types/session'

const baseSession: SessionDocument = {
  id: 'session-1',
  name: 'Compare app source',
  sessionType: 'text-compare',
  locations: {},
  view: {
    layout: 'side-by-side',
    showEqual: true,
    showDifferent: true,
    showUnimportant: true,
    contextLines: 3,
  },
  rules: { filters: [], comparison: {} },
  metadata: {
    folder: 'Work/App',
    locked: false,
    dirty: false,
    autoSaved: false,
    shared: false,
  },
}

describe('buildSavedSessionTree', () => {
  it('groups sessions by folder hierarchy', () => {
    const tree = buildSavedSessionTree([
      baseSession,
      {
        ...baseSession,
        id: 'session-2',
        name: 'Compare docs',
        metadata: { ...baseSession.metadata, folder: 'Work/Docs' },
      },
    ])

    expect(tree).toMatchObject([
      {
        kind: 'folder',
        name: 'Work',
        children: [
          { kind: 'folder', name: 'App', children: [{ kind: 'session', session: baseSession }] },
          { kind: 'folder', name: 'Docs' },
        ],
      },
    ])
  })

  it('keeps sessions without folders at the root', () => {
    const rootSession = {
      ...baseSession,
      id: 'root-session',
      metadata: { ...baseSession.metadata },
    }

    delete rootSession.metadata.folder

    expect(buildSavedSessionTree([rootSession])).toEqual([
      { kind: 'session', id: 'root-session', name: 'Compare app source', session: rootSession },
    ])
  })
})
