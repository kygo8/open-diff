import { beforeEach, describe, expect, it } from 'vitest'
import {
  folderPathMruStorageKey,
  loadFolderPathMru,
  rememberFolderPath,
  rememberFolderPathPair,
  saveFolderPathMru,
} from './folderPathMru'

describe('folderPathMru', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists and reloads folder path history', () => {
    saveFolderPathMru(['/a', '/b'])
    expect(loadFolderPathMru()).toEqual(['/a', '/b'])
    expect(localStorage.getItem(folderPathMruStorageKey)).toContain('/a')
  })

  it('promotes reused paths and drops blanks', () => {
    expect(rememberFolderPath(['/old', '/kept'], '/kept')).toEqual(['/kept', '/old'])
    expect(rememberFolderPath(['/old'], '   ')).toEqual(['/old'])
  })

  it('records both sides of a compare pair with right most recent', () => {
    expect(rememberFolderPathPair(['/prior'], '/left', '/right')).toEqual([
      '/right',
      '/left',
      '/prior',
    ])
  })
})
