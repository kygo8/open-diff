import { beforeEach, describe, expect, it } from 'vitest'
import {
  defaultFolderNameFilters,
  folderNameFilterAllPattern,
  folderNameFiltersAreActive,
  folderNameFiltersStorageKey,
  formatFolderNameFilterDraft,
  formatFolderNameFilterStripPattern,
  loadFolderNameFilters,
  normalizeFolderNameFilters,
  parseFolderNameFilterDraft,
  parseFolderNameFilterStripPattern,
  saveFolderNameFilters,
} from './folderNameFilters'

describe('folderNameFilters', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('parses and formats include/exclude drafts', () => {
    expect(parseFolderNameFilterDraft('*.ts, src/**\n*.tmp ; docs')).toEqual([
      '*.ts',
      'src/**',
      '*.tmp',
      'docs',
    ])
    expect(formatFolderNameFilterDraft(['*.ts', '*.md'])).toBe('*.ts\n*.md')
  })

  it('normalizes partial payloads', () => {
    expect(
      normalizeFolderNameFilters({
        include: ['  *.rs ', '', 12 as unknown as string],
        exclude: ['target/**'],
        caseSensitive: true,
      }),
    ).toEqual({
      include: ['*.rs'],
      exclude: ['target/**'],
      caseSensitive: true,
    })
    expect(defaultFolderNameFilters()).toEqual({
      include: [],
      exclude: [],
      caseSensitive: false,
    })
  })

  it('persists and reloads name filters', () => {
    saveFolderNameFilters({
      include: ['*.vue'],
      exclude: ['node_modules/**'],
      caseSensitive: false,
    })

    const stored = JSON.parse(localStorage.getItem(folderNameFiltersStorageKey) ?? '{}') as {
      include: string[]
      exclude: string[]
    }

    expect(stored.include).toEqual(['*.vue'])
    expect(stored.exclude).toEqual(['node_modules/**'])
    expect(loadFolderNameFilters()).toEqual({
      include: ['*.vue'],
      exclude: ['node_modules/**'],
      caseSensitive: false,
    })
    expect(
      folderNameFiltersAreActive({
        include: ['*.vue'],
        exclude: [],
        caseSensitive: false,
      }),
    ).toBe(true)
    expect(folderNameFiltersAreActive(defaultFolderNameFilters())).toBe(false)
  })
})

it('formats and parses the capture-like Filters strip pattern', () => {
  expect(formatFolderNameFilterStripPattern(defaultFolderNameFilters())).toBe(
    folderNameFilterAllPattern,
  )
  expect(
    formatFolderNameFilterStripPattern({
      include: ['*.ts', '*.vue'],
      exclude: [],
      caseSensitive: false,
    }),
  ).toBe('*.ts;*.vue')
  expect(parseFolderNameFilterStripPattern('*.*')).toEqual([])
  expect(parseFolderNameFilterStripPattern('')).toEqual([])
  expect(parseFolderNameFilterStripPattern('*.ts; *.md')).toEqual(['*.ts', '*.md'])
})
