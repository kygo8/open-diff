import { describe, expect, it } from 'vitest'
import {
  createDefaultSessionMetadata,
  createDefaultSessionViewState,
  createLocalSessionLocation,
  isSessionType,
  sessionTypes,
} from './session'

describe('session types', () => {
  it('keeps frontend session type values aligned with Rust kebab-case serialization', () => {
    expect(sessionTypes).toEqual([
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
    ])
  })

  it('narrows unknown strings to supported session types', () => {
    expect(isSessionType('text-compare')).toBe(true)
    expect(isSessionType('unknown')).toBe(false)
  })

  it('creates default session fragments matching the Rust defaults', () => {
    expect(createLocalSessionLocation('left.txt')).toEqual({
      uri: 'left.txt',
      readOnly: false,
    })
    expect(createDefaultSessionViewState()).toMatchObject({
      layout: 'side-by-side',
      contextLines: 3,
    })
    expect(createDefaultSessionMetadata()).toMatchObject({
      locked: false,
      dirty: false,
      autoSaved: false,
      shared: false,
    })
  })
})
