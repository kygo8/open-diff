import { describe, expect, it } from 'vitest'
import { selectSessionForDrop } from './sessionAutoSelect'
import type { ValidDropClassification } from './dropInput'

function pair(
  leftPath: string,
  rightPath: string,
  leftKind: 'file' | 'directory' = 'file',
  rightKind: 'file' | 'directory' = leftKind,
): ValidDropClassification {
  let kind: ValidDropClassification['kind'] = 'mixed'

  if (leftKind === 'directory' && rightKind === 'directory') {
    kind = 'folders'
  }

  if (leftKind === 'file' && rightKind === 'file') {
    kind = 'files'
  }

  return {
    kind,
    left: { path: leftPath, kind: leftKind, sourceKind: leftKind, displayName: leftPath },
    right: { path: rightPath, kind: rightKind, sourceKind: rightKind, displayName: rightPath },
  }
}

describe('selectSessionForDrop', () => {
  it('selects folder compare for two directories', () => {
    expect(selectSessionForDrop(pair('left', 'right', 'directory'))).toMatchObject({
      sessionType: 'folder-compare',
      route: '/compare/folder',
      enabled: true,
    })
  })

  it('selects text compare for common text file extensions', () => {
    expect(selectSessionForDrop(pair('left.ts', 'right.ts'))).toMatchObject({
      sessionType: 'text-compare',
      route: '/compare/text',
      enabled: true,
    })
  })

  it('selects picture compare for image extensions', () => {
    expect(selectSessionForDrop(pair('before.png', 'after.jpeg'))).toMatchObject({
      sessionType: 'picture-compare',
      enabled: false,
    })
  })

  it('selects hex compare for binary or unknown file extensions', () => {
    expect(selectSessionForDrop(pair('left.exe', 'right.dll'))).toMatchObject({
      sessionType: 'hex-compare',
      enabled: false,
    })
  })

  it('falls back to hex compare for mixed inputs', () => {
    expect(selectSessionForDrop(pair('left.txt', 'right', 'file', 'directory'))).toMatchObject({
      sessionType: 'hex-compare',
      enabled: false,
    })
  })
})
