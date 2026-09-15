import { beforeEach, describe, expect, it } from 'vitest'
import {
  archiveExtensionsStorageKey,
  archiveSideLabel,
  formatArchiveSuffixesInput,
  isArchivePath,
  parseArchiveSuffixesInput,
  resetArchiveSuffixes,
  setArchiveSuffixes,
} from './archivePath'

describe('archivePath', () => {
  beforeEach(() => {
    localStorage.clear()
    resetArchiveSuffixes()
  })

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

  it('persists custom archive suffixes used by Folder Compare', () => {
    expect(setArchiveSuffixes(['.zip', 'rar', '.ZIP', ''])).toEqual(['.rar', '.zip'])
    expect(isArchivePath('pack.rar')).toBe(true)
    expect(isArchivePath('pack.7z')).toBe(false)
    expect(JSON.parse(localStorage.getItem(archiveExtensionsStorageKey) ?? '[]')).toEqual([
      '.rar',
      '.zip',
    ])
    expect(formatArchiveSuffixesInput()).toBe('.rar, .zip')
    expect(parseArchiveSuffixesInput('.zip, tar.gz ; 7z')).toEqual(
      expect.arrayContaining(['.tar.gz', '.zip', '.7z']),
    )
    expect(parseArchiveSuffixesInput('.zip, tar.gz ; 7z')[0]).toBe('.tar.gz')
    expect(parseArchiveSuffixesInput('.zip, tar.gz ; 7z')).toHaveLength(3)
  })
})
