import { describe, expect, it } from 'vitest'
import { createSessionFromLaunch, createUntitledSession } from './sessionFactory'

describe('sessionFactory', () => {
  it('creates a named session from launch locations', () => {
    const session = createSessionFromLaunch({
      id: 'launch-1',
      source: 'drop',
      sessionType: 'folder-compare',
      title: 'left vs right',
      route: '/compare/folder',
      autoRun: true,
      locations: {
        left: { uri: 'D:/left', kind: 'directory', readOnly: false },
        right: { uri: 'D:/right', kind: 'directory', readOnly: false },
      },
    })

    expect(session.name).toBe('left vs right')
    expect(session.sessionType).toBe('folder-compare')
    expect(session.locations.left?.uri).toBe('D:/left')
    expect(session.metadata.dirty).toBe(false)
  })

  it('creates an untitled session for a direct launcher entry', () => {
    const session = createUntitledSession('text-patch')

    expect(session.name).toBe('Untitled Text Patch')
    expect(session.sessionType).toBe('text-patch')
    expect(session.view.layout).toBe('side-by-side')
  })
})
