import { afterEach, describe, expect, it } from 'vitest'
import {
  fileFormatsStorageKey,
  loadFileFormats,
  matchFileFormat,
  optionsFormatAssociationIds,
  saveFileFormats,
  sessionTypeForPath,
  setFileFormatEnabled,
} from './fileFormats'

describe('fileFormats', () => {
  afterEach(() => {
    localStorage.removeItem(fileFormatsStorageKey)
  })

  it('routes csv, registry, image, and patch paths from persisted formats', () => {
    expect(sessionTypeForPath('report.csv')).toBe('table-compare')
    expect(sessionTypeForPath('export.reg')).toBe('registry-compare')
    expect(sessionTypeForPath('photo.webp')).toBe('picture-compare')
    expect(sessionTypeForPath('change.patch')).toBe('text-patch')
    expect(sessionTypeForPath('release.zip')).toBe('archive-compare')
    expect(sessionTypeForPath('bundle.tar.gz')).toBe('archive-compare')
  })

  it('lets saved file formats influence open routing', () => {
    const formats = loadFileFormats()
    const rust = formats.find((format) => format.id === 'source-code')

    expect(rust).toBeDefined()
    if (rust) {
      rust.matcher.extensions.push('bin')
      rust.defaultView = 'text'
    }

    saveFileFormats(formats)

    expect(matchFileFormat('payload.bin')?.defaultView).toBe('text')
    expect(sessionTypeForPath('payload.bin')).toBe('text-compare')
  })

  it('skips disabled format associations when routing by extension', () => {
    const formats = loadFileFormats()

    setFileFormatEnabled(formats, 'images', false)

    expect(matchFileFormat('photo.webp')).toBeUndefined()
    expect(sessionTypeForPath('photo.webp')).toBe('hex-compare')

    setFileFormatEnabled(loadFileFormats(), 'images', true)
    expect(sessionTypeForPath('photo.webp')).toBe('picture-compare')
  })

  it('exposes the denser Options format association checklist', () => {
    expect(optionsFormatAssociationIds).toEqual(
      expect.arrayContaining([
        'plain-text',
        'rust',
        'patch',
        'zip-archive',
        'tar-archive',
        'images',
      ]),
    )
  })
})
