export const versionCompareOptionsStorageKey = 'open-diff-version-compare-options'

export const versionFieldFilters = ['all', 'diffs', 'same', 'minor'] as const

export type VersionFieldFilter = (typeof versionFieldFilters)[number]

/** Default fields treated as unimportant (minor) when comparing version resources. */
export const defaultUnimportantVersionFields = [
  'Comments',
  'LegalCopyright',
  'LegalTrademarks',
  'PrivateBuild',
  'SpecialBuild',
  'InternalName',
] as const

/** Catalog of common version resource fields shown in Importance Rules before/without a compare. */
export const knownVersionRuleFields = [
  'FileVersion',
  'ProductVersion',
  'CompanyName',
  'FileDescription',
  'ProductName',
  'OriginalFilename',
  'InternalName',
  'LegalCopyright',
  'LegalTrademarks',
  'Comments',
  'PrivateBuild',
  'SpecialBuild',
] as const

export function versionRuleFieldGroup(field: string): string {
  if (field === 'FileVersion' || field === 'ProductVersion') {
    return 'Fixed Info'
  }

  return 'String Info'
}

export function buildVersionRulesCatalog(
  extraFields: string[] = [],
): { field: string; group: string }[] {
  const names = [
    ...new Set([
      ...knownVersionRuleFields,
      ...extraFields.map((field) => field.trim()).filter(Boolean),
    ]),
  ]

  return names.map((field) => ({
    field,
    group: versionRuleFieldGroup(field),
  }))
}

export interface VersionCompareOptionsState {
  unimportantFields: string[]
  /** Initial field-row filter for new Version Compare sessions. */
  defaultFilter: VersionFieldFilter
  /** Open Importance Rules panel when a Version Compare session starts. */
  showRules: boolean
}

export function normalizeVersionFieldFilter(value: unknown): VersionFieldFilter {
  if (typeof value === 'string' && (versionFieldFilters as readonly string[]).includes(value)) {
    return value as VersionFieldFilter
  }

  return 'all'
}

export function defaultVersionCompareOptions(): VersionCompareOptionsState {
  return {
    unimportantFields: [...defaultUnimportantVersionFields],
    defaultFilter: 'all',
    showRules: false,
  }
}

function normalizeFieldList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...defaultUnimportantVersionFields]
  }

  const fields = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return [...new Set(fields)]
}

export function loadVersionCompareOptions(
  storage: Pick<Storage, 'getItem'> = localStorage,
): VersionCompareOptionsState {
  try {
    const raw = storage.getItem(versionCompareOptionsStorageKey)

    if (!raw) {
      return defaultVersionCompareOptions()
    }

    const parsed = JSON.parse(raw) as Partial<VersionCompareOptionsState>
    const defaults = defaultVersionCompareOptions()

    return {
      unimportantFields: normalizeFieldList(parsed.unimportantFields),
      defaultFilter: normalizeVersionFieldFilter(parsed.defaultFilter ?? defaults.defaultFilter),
      showRules: parsed.showRules === true,
    }
  } catch {
    return defaultVersionCompareOptions()
  }
}

export function saveVersionCompareOptions(
  state: VersionCompareOptionsState,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    versionCompareOptionsStorageKey,
    JSON.stringify({
      unimportantFields: normalizeFieldList(state.unimportantFields),
      defaultFilter: normalizeVersionFieldFilter(state.defaultFilter),
      showRules: state.showRules,
    }),
  )
}

export function isVersionFieldImportant(
  field: string,
  options: Pick<VersionCompareOptionsState, 'unimportantFields'>,
): boolean {
  const normalized = field.trim().toLowerCase()

  return !options.unimportantFields.some((entry) => entry.trim().toLowerCase() === normalized)
}

export function toggleVersionFieldImportance(
  field: string,
  options: VersionCompareOptionsState,
): VersionCompareOptionsState {
  const important = isVersionFieldImportant(field, options)

  if (important) {
    return {
      ...options,
      unimportantFields: [...options.unimportantFields, field],
    }
  }

  return {
    ...options,
    unimportantFields: options.unimportantFields.filter(
      (entry) => entry.trim().toLowerCase() !== field.trim().toLowerCase(),
    ),
  }
}

export function resetVersionCompareOptions(): VersionCompareOptionsState {
  return defaultVersionCompareOptions()
}
