import { describe, expect, it } from 'vitest'
import { archiveSideLabel, isArchivePath } from './archivePath'

describe('archivePath', () => {
  it('detects implemented ZIP/TAR/7z family paths', () => {
    expect(isArchivePath('/tmp/pkg.zip')).toBe(true)
    expect(isArchivePath('C:\\data\\bundle.TAR.GZ')).toBe(true)
    expect(isArchivePath('notes.tgz')).toBe(true)
    expect(isArchivePath('plain.tar')).toBe(true)
    expect(isArchivePath('single.gz')).toBe(true)
    expect(isArchivePath('pkg.7z')).toBe(true)
    expect(isArchivePath('/tmp/folder')).toBe(false)
    expect(isArchivePath('')).toBe(false)
  })

  it('labels sides as archive or folder', () => {
    expect(archiveSideLabel('a.zip')).toBe('archive')
    expect(archiveSideLabel('/home/user/docs')).toBe('folder')
  })
})
