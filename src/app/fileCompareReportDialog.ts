/** File Compare Report… dialog options for Folder Compare (format + scope). */

import { reportFileExtension, type ReportExportFormat } from '@/app/reportExports'

export type FileCompareReportScope = 'full' | 'selection'
export type FileCompareReportFormat = ReportExportFormat

export const fileCompareReportFormats: readonly FileCompareReportFormat[] = [
  'html',
  'text',
  'json',
  'xml',
  'csv',
  'markdown',
] as const

export interface FileCompareReportDialogState {
  format: FileCompareReportFormat
  scope: FileCompareReportScope
}

export function defaultFileCompareReportDialogState(): FileCompareReportDialogState {
  return {
    format: 'html',
    scope: 'full',
  }
}

/** Honest enablement: only after a folder compare has produced rows. */
export function canOpenFileCompareReport(hasCompareResult: boolean): boolean {
  return hasCompareResult
}

export function normalizeFileCompareReportFormat(value: unknown): FileCompareReportFormat {
  if (
    typeof value === 'string' &&
    (fileCompareReportFormats as readonly string[]).includes(value)
  ) {
    return value as FileCompareReportFormat
  }

  return 'html'
}

export function normalizeFileCompareReportScope(value: unknown): FileCompareReportScope {
  return value === 'selection' ? 'selection' : 'full'
}

export function fileCompareReportOutputPath(
  leftRoot: string,
  format: FileCompareReportFormat,
  scope: FileCompareReportScope,
): string {
  const trimmed = leftRoot.trim().replace(/[/\\]+$/u, '')
  const baseName = scope === 'selection' ? 'folder-compare-selection' : 'folder-compare'
  const extension = reportFileExtension(format)

  if (!trimmed) {
    return `${baseName}.${extension}`
  }

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))

  if (slash < 0) {
    return `${baseName}.${extension}`
  }

  return `${trimmed.slice(0, slash + 1)}${baseName}.${extension}`
}

export function fileCompareReportFormatLabelKey(format: FileCompareReportFormat): string {
  switch (format) {
    case 'html':
      return 'ui.reportFormatHtml'
    case 'text':
      return 'ui.reportFormatText'
    case 'json':
      return 'ui.reportFormatJson'
    case 'xml':
      return 'ui.reportFormatXml'
    case 'csv':
      return 'ui.reportFormatCsv'
    case 'markdown':
      return 'ui.reportFormatMarkdown'
    default: {
      const _exhaustive: never = format

      return _exhaustive
    }
  }
}
