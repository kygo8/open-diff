import { describe, expect, it } from 'vitest'
import { parentDirectoryPath } from './parentDirectoryPath'

describe('parentDirectoryPath', () => {
  it('climbs posix and windows folder paths and stops at roots', () => {
    expect(parentDirectoryPath('/a/b/c')).toBe('/a/b')
    expect(parentDirectoryPath('/a')).toBe('/')
    expect(parentDirectoryPath('/')).toBeUndefined()
    expect(parentDirectoryPath('C:\\work\\repo')).toBe('C:\\work')
    expect(parentDirectoryPath('C:\\work')).toBeUndefined()
    expect(parentDirectoryPath('C:\\')).toBeUndefined()
    expect(parentDirectoryPath('')).toBeUndefined()
  })
})
