export const reportExportsStorageKey = 'open-diff-recent-report-exports'
export const maxRecentReportExports = 20

export interface RecentReportExport {
  name: string
  type: string
  stateKey: string
  target: string
  createdAt: string
}

export function loadRecentReportExports(): RecentReportExport[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(reportExportsStorageKey) ?? 'null') as unknown

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isRecentReportExport).slice(0, maxRecentReportExports)
  } catch {
    return []
  }
}

export function saveRecentReportExports(exports: RecentReportExport[]): void {
  localStorage.setItem(
    reportExportsStorageKey,
    JSON.stringify(exports.slice(0, maxRecentReportExports)),
  )
}

export function recordRecentReportExport(
  existing: RecentReportExport[],
  next: Omit<RecentReportExport, 'createdAt'> & { createdAt?: string },
): RecentReportExport[] {
  const entry: RecentReportExport = {
    name: next.name,
    type: next.type,
    stateKey: next.stateKey,
    target: next.target,
    createdAt: next.createdAt ?? new Date().toISOString(),
  }
  const merged = [entry, ...existing.filter((item) => item.target !== entry.target)].slice(
    0,
    maxRecentReportExports,
  )

  saveRecentReportExports(merged)

  return merged
}

function isRecentReportExport(value: unknown): value is RecentReportExport {
  if (!value || typeof value !== 'object') {
    return false
  }

  const item = value as Partial<RecentReportExport>

  return (
    typeof item.name === 'string' &&
    typeof item.type === 'string' &&
    typeof item.stateKey === 'string' &&
    typeof item.target === 'string' &&
    typeof item.createdAt === 'string'
  )
}

export type ReportExportFormat = 'html' | 'text' | 'json' | 'xml' | 'csv' | 'markdown'

export function reportFileExtension(format: ReportExportFormat): string {
  if (format === 'text') {
    return 'txt'
  }

  if (format === 'markdown') {
    return 'md'
  }

  return format
}

export const reportPreferencesStorageKey = 'open-diff-report-preferences'

export type ReportPreferenceFormat =
  'html' | 'html-side-by-side' | 'text' | 'json' | 'csv' | 'markdown' | 'xml'

export type ReportPreferenceKind = 'text' | 'folder'

export interface ReportPreferences {
  defaultFormat: ReportPreferenceFormat
  defaultKind: ReportPreferenceKind
  openAfterExport: boolean
  clearHistoryOnExit: boolean
}

const reportPreferenceFormats: readonly ReportPreferenceFormat[] = [
  'html',
  'html-side-by-side',
  'text',
  'json',
  'csv',
  'markdown',
  'xml',
]

export function defaultReportPreferences(): ReportPreferences {
  return {
    defaultFormat: 'html',
    defaultKind: 'text',
    openAfterExport: false,
    clearHistoryOnExit: false,
  }
}

export function normalizeReportPreferenceFormat(value: unknown): ReportPreferenceFormat {
  if (typeof value === 'string' && (reportPreferenceFormats as readonly string[]).includes(value)) {
    return value as ReportPreferenceFormat
  }

  return 'html'
}

export function normalizeReportPreferenceKind(value: unknown): ReportPreferenceKind {
  return value === 'folder' ? 'folder' : 'text'
}

export function loadReportPreferences(
  storage: Pick<Storage, 'getItem'> = localStorage,
): ReportPreferences {
  try {
    const raw = storage.getItem(reportPreferencesStorageKey)

    if (!raw) {
      return defaultReportPreferences()
    }

    const parsed = JSON.parse(raw) as Partial<ReportPreferences>

    return {
      defaultFormat: normalizeReportPreferenceFormat(parsed.defaultFormat),
      defaultKind: normalizeReportPreferenceKind(parsed.defaultKind),
      openAfterExport: Boolean(parsed.openAfterExport),
      clearHistoryOnExit: Boolean(parsed.clearHistoryOnExit),
    }
  } catch {
    return defaultReportPreferences()
  }
}

export function saveReportPreferences(
  prefs: ReportPreferences,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(reportPreferencesStorageKey, JSON.stringify(prefs))
}

export function clearRecentReportExports(
  storage: Pick<Storage, 'removeItem'> = localStorage,
): void {
  storage.removeItem(reportExportsStorageKey)
}
