import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildVersionRulesCatalog,
  defaultVersionCompareOptions,
  isVersionFieldImportant,
  loadVersionCompareOptions,
  resetVersionCompareOptions,
  saveVersionCompareOptions,
  toggleVersionFieldImportance,
  versionCompareOptionsStorageKey,
} from './versionCompareOptions'

describe('versionCompareOptions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads defaults and persists session defaults with unimportant fields', () => {
    const loadedVersion = loadVersionCompareOptions()

    expect(loadedVersion.unimportantFields).toContain('Comments')
    expect(loadedVersion.defaultFilter).toBe('all')
    expect(loadedVersion.showRules).toBe(false)

    saveVersionCompareOptions({
      unimportantFields: ['Comments', 'FileVersion'],
      defaultFilter: 'diffs',
      showRules: true,
    })

    expect(localStorage.getItem(versionCompareOptionsStorageKey)).toContain('FileVersion')
    expect(loadVersionCompareOptions()).toMatchObject({
      unimportantFields: ['Comments', 'FileVersion'],
      defaultFilter: 'diffs',
      showRules: true,
    })
  })

  it('toggles field importance while preserving session defaults', () => {
    const base = defaultVersionCompareOptions()

    expect(isVersionFieldImportant('FileVersion', base)).toBe(true)
    expect(isVersionFieldImportant('Comments', base)).toBe(false)

    const demoted = toggleVersionFieldImportance('FileVersion', {
      ...base,
      defaultFilter: 'minor',
      showRules: true,
    })

    expect(isVersionFieldImportant('FileVersion', demoted)).toBe(false)
    expect(demoted.defaultFilter).toBe('minor')
    expect(demoted.showRules).toBe(true)

    const promoted = toggleVersionFieldImportance('Comments', demoted)

    expect(isVersionFieldImportant('Comments', promoted)).toBe(true)
  })
})

it('builds a rules catalog with known fields and extras', () => {
  const catalog = buildVersionRulesCatalog(['CustomField'])

  expect(catalog.some((row) => row.field === 'FileVersion')).toBe(true)
  expect(catalog.some((row) => row.field === 'Comments')).toBe(true)
  expect(catalog.some((row) => row.field === 'CustomField')).toBe(true)
})

it('resets importance rules and session defaults', () => {
  saveVersionCompareOptions({
    unimportantFields: ['FileVersion'],
    defaultFilter: 'same',
    showRules: true,
  })
  const reset = resetVersionCompareOptions()

  saveVersionCompareOptions(reset)

  expect(loadVersionCompareOptions()).toEqual(defaultVersionCompareOptions())
})
