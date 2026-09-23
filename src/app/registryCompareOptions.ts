export const registryCompareOptionsStorageKey = 'open-diff-registry-compare-options'

export const registryValueFilters = ['all', 'diffs', 'same'] as const

export type RegistryValueFilter = (typeof registryValueFilters)[number]

export interface RegistryCompareOptionsState {
  /** Initial registry value-row filter for new Registry Compare sessions. */
  defaultFilter: RegistryValueFilter
}

export function normalizeRegistryValueFilter(value: unknown): RegistryValueFilter {
  if (typeof value === 'string' && (registryValueFilters as readonly string[]).includes(value)) {
    return value as RegistryValueFilter
  }

  return 'all'
}

export function defaultRegistryCompareOptions(): RegistryCompareOptionsState {
  return {
    defaultFilter: 'all',
  }
}

export function loadRegistryCompareOptions(
  storage: Pick<Storage, 'getItem'> = localStorage,
): RegistryCompareOptionsState {
  try {
    const raw = storage.getItem(registryCompareOptionsStorageKey)

    if (!raw) {
      return defaultRegistryCompareOptions()
    }

    const parsed = JSON.parse(raw) as Partial<RegistryCompareOptionsState>
    const defaults = defaultRegistryCompareOptions()

    return {
      defaultFilter: normalizeRegistryValueFilter(parsed.defaultFilter ?? defaults.defaultFilter),
    }
  } catch {
    return defaultRegistryCompareOptions()
  }
}

export function saveRegistryCompareOptions(
  state: RegistryCompareOptionsState,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    registryCompareOptionsStorageKey,
    JSON.stringify({
      defaultFilter: normalizeRegistryValueFilter(state.defaultFilter),
    }),
  )
}
