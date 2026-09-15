import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildMediaRulesCatalog,
  defaultMediaCompareOptions,
  isMediaFieldImportant,
  loadMediaCompareOptions,
  mediaCompareOptionsStorageKey,
  resetMediaCompareOptions,
  saveMediaCompareOptions,
  toggleMediaFieldImportance,
} from './mediaCompareOptions'

describe('mediaCompareOptions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads defaults and persists session defaults with unimportant fields', () => {
    const loadedMedia = loadMediaCompareOptions()

    expect(loadedMedia.unimportantFields).toContain('Comment')
    expect(loadedMedia.syncPlayback).toBe(true)
    expect(loadedMedia.defaultFilter).toBe('all')
    expect(loadedMedia.showRules).toBe(false)

    saveMediaCompareOptions({
      unimportantFields: ['Comment', 'Title'],
      syncPlayback: false,
      defaultFilter: 'diffs',
      showRules: true,
    })

    expect(localStorage.getItem(mediaCompareOptionsStorageKey)).toContain('Title')
    expect(loadMediaCompareOptions()).toMatchObject({
      unimportantFields: ['Comment', 'Title'],
      syncPlayback: false,
      defaultFilter: 'diffs',
      showRules: true,
    })
  })

  it('toggles field importance while preserving session defaults', () => {
    const base = defaultMediaCompareOptions()

    expect(isMediaFieldImportant('Title', base)).toBe(true)
    expect(isMediaFieldImportant('Comment', base)).toBe(false)

    const demoted = toggleMediaFieldImportance('Title', {
      ...base,
      syncPlayback: false,
      defaultFilter: 'minor',
      showRules: true,
    })

    expect(isMediaFieldImportant('Title', demoted)).toBe(false)
    expect(demoted.syncPlayback).toBe(false)
    expect(demoted.defaultFilter).toBe('minor')
    expect(demoted.showRules).toBe(true)

    const promoted = toggleMediaFieldImportance('Comment', demoted)

    expect(isMediaFieldImportant('Comment', promoted)).toBe(true)
  })
})

it('builds a rules catalog with known fields and extras', () => {
  const catalog = buildMediaRulesCatalog(['CustomTag'])

  expect(catalog.some((row) => row.field === 'Title')).toBe(true)
  expect(catalog.some((row) => row.field === 'Comment')).toBe(true)
  expect(catalog.some((row) => row.field === 'CustomTag')).toBe(true)
})

it('resets importance rules and session defaults', () => {
  saveMediaCompareOptions({
    unimportantFields: ['Title'],
    syncPlayback: false,
    defaultFilter: 'same',
    showRules: true,
  })
  const reset = resetMediaCompareOptions()

  saveMediaCompareOptions(reset)

  expect(loadMediaCompareOptions()).toEqual(defaultMediaCompareOptions())
})
