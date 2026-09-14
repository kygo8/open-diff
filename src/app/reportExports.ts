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
