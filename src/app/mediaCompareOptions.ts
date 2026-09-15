export const mediaCompareOptionsStorageKey = 'open-diff-media-compare-options'

export const mediaFieldFilters = ['all', 'diffs', 'same', 'minor'] as const

export type MediaFieldFilter = (typeof mediaFieldFilters)[number]

/** Default tag fields treated as unimportant (minor) when comparing media metadata. */
export const defaultUnimportantMediaFields = [
  'Comment',
  'Comments',
  'Copyright',
  'EncodedBy',
  'Encoder',
  'EncodingSettings',
  'Software',
] as const

/** Catalog of common media tag fields shown in Importance Rules before/without a compare. */
export const knownMediaRuleFields = [
  'Title',
  'Artist',
  'Album',
  'AlbumArtist',
  'Track',
  'TrackNumber',
  'Disc',
  'Genre',
  'Year',
  'Date',
  'Composer',
  'Comment',
  'Comments',
  'Copyright',
  'EncodedBy',
  'Encoder',
  'EncodingSettings',
  'Software',
] as const

export function mediaRuleFieldGroup(field: string): string {
  const normalized = field.trim().toLowerCase()

  if (
    normalized === 'comment' ||
    normalized === 'comments' ||
    normalized === 'copyright' ||
    normalized === 'encodedby' ||
    normalized === 'encoder' ||
    normalized === 'encodingsettings' ||
    normalized === 'software'
  ) {
    return 'Extra'
  }

  return 'Tags'
}

export function buildMediaRulesCatalog(
  extraFields: string[] = [],
): { field: string; group: string }[] {
  const names = [
    ...new Set([
      ...knownMediaRuleFields,
      ...extraFields.map((field) => field.trim()).filter(Boolean),
    ]),
  ]

  return names.map((field) => ({
    field,
    group: mediaRuleFieldGroup(field),
  }))
}

export interface MediaCompareOptionsState {
  unimportantFields: string[]
  /** Keep left/right media players scrubbed together by default. */
  syncPlayback: boolean
  /** Initial field-row filter for new Media Compare sessions. */
  defaultFilter: MediaFieldFilter
  /** Open Importance Rules panel when a Media Compare session starts. */
  showRules: boolean
}

export function normalizeMediaFieldFilter(value: unknown): MediaFieldFilter {
  if (typeof value === 'string' && (mediaFieldFilters as readonly string[]).includes(value)) {
    return value as MediaFieldFilter
  }

  return 'all'
}

export function defaultMediaCompareOptions(): MediaCompareOptionsState {
  return {
    unimportantFields: [...defaultUnimportantMediaFields],
    syncPlayback: true,
    defaultFilter: 'all',
    showRules: false,
  }
}

function normalizeFieldList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [...defaultUnimportantMediaFields]
  }

  const fields = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return [...new Set(fields)]
}

export function loadMediaCompareOptions(
  storage: Pick<Storage, 'getItem'> = localStorage,
): MediaCompareOptionsState {
  try {
    const raw = storage.getItem(mediaCompareOptionsStorageKey)

    if (!raw) {
      return defaultMediaCompareOptions()
    }

    const parsed = JSON.parse(raw) as Partial<MediaCompareOptionsState>
    const defaults = defaultMediaCompareOptions()

    return {
      unimportantFields: normalizeFieldList(parsed.unimportantFields),
      syncPlayback: parsed.syncPlayback !== false,
      defaultFilter: normalizeMediaFieldFilter(parsed.defaultFilter ?? defaults.defaultFilter),
      showRules: parsed.showRules === true,
    }
  } catch {
    return defaultMediaCompareOptions()
  }
}

export function saveMediaCompareOptions(
  state: MediaCompareOptionsState,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(
    mediaCompareOptionsStorageKey,
    JSON.stringify({
      unimportantFields: normalizeFieldList(state.unimportantFields),
      syncPlayback: state.syncPlayback,
      defaultFilter: normalizeMediaFieldFilter(state.defaultFilter),
      showRules: state.showRules,
    }),
  )
}

export function isMediaFieldImportant(
  field: string,
  options: Pick<MediaCompareOptionsState, 'unimportantFields'>,
): boolean {
  const normalized = field.trim().toLowerCase()

  return !options.unimportantFields.some((entry) => entry.trim().toLowerCase() === normalized)
}

export function toggleMediaFieldImportance(
  field: string,
  options: MediaCompareOptionsState,
): MediaCompareOptionsState {
  const important = isMediaFieldImportant(field, options)

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

export function resetMediaCompareOptions(): MediaCompareOptionsState {
  return defaultMediaCompareOptions()
}
