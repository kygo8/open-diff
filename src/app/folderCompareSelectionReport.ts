/** Selection-scoped Folder / File Compare report content builders. */

import type { ReportExportFormat } from '@/app/reportExports'

export interface FolderCompareSelectionReportRow {
  relativePath: string
  status: string
  kind: 'file' | 'directory'
  leftPath?: string
  rightPath?: string
  ignored?: boolean
}

export interface BuildFolderCompareSelectionReportTextInput {
  leftRoot: string
  rightRoot: string
  rows: FolderCompareSelectionReportRow[]
  scopeLabel?: string
}

export function defaultFolderCompareSelectionReportOutputPath(leftRoot: string): string {
  const trimmed = leftRoot.trim().replace(/[/\\]+$/u, '')

  if (!trimmed) {
    return 'folder-compare-selection.txt'
  }

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))

  if (slash < 0) {
    return 'folder-compare-selection.txt'
  }

  return `${trimmed.slice(0, slash + 1)}folder-compare-selection.txt`
}

function displayOrDash(value: string | undefined): string {
  const trimmed = value?.trim() ?? ''

  return trimmed.length > 0 ? trimmed : '--'
}

export function buildFolderCompareSelectionReportText(
  input: BuildFolderCompareSelectionReportTextInput,
): string {
  const rows = input.rows
  const files = rows.filter((row) => row.kind === 'file').length
  const directories = rows.filter((row) => row.kind === 'directory').length
  const ignored = rows.filter((row) => row.ignored === true).length
  const scopeLabel = input.scopeLabel?.trim() ?? ''
  const scope = scopeLabel.length > 0 ? scopeLabel : 'selection'
  const lines = [
    'FOLDER-COMPARE-SELECTION-REPORT',
    `scope: ${scope}`,
    `left: ${displayOrDash(input.leftRoot)}`,
    `right: ${displayOrDash(input.rightRoot)}`,
    `selected: ${String(rows.length)}`,
    `files: ${String(files)}`,
    `directories: ${String(directories)}`,
    `ignored: ${String(ignored)}`,
    '',
    'rows:',
    ...rows.map((row) => {
      const ignoredMark = row.ignored === true ? 'ignored' : '-'
      const left = displayOrDash(row.leftPath)
      const right = displayOrDash(row.rightPath)

      return [row.relativePath, row.status, row.kind, ignoredMark, left, right].join('\t')
    }),
  ]

  return lines.join('\n')
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeHtml(value: string): string {
  return escapeXml(value).replaceAll("'", '&#39;')
}

function csvEscape(value: string): string {
  if (/[",\n\r]/u.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }

  return value
}

/** Serialize selection rows for the chosen export format (client-side). */
export function buildFolderCompareSelectionReportContent(
  format: ReportExportFormat,
  input: BuildFolderCompareSelectionReportTextInput,
): string {
  if (format === 'text' || format === 'markdown') {
    const text = buildFolderCompareSelectionReportText(input)

    if (format === 'markdown') {
      return ['# Folder Compare Selection Report', '', '```', text, '```'].join('\n')
    }

    return text
  }

  const trimmedScope = input.scopeLabel?.trim() ?? ''
  const scope = trimmedScope.length > 0 ? trimmedScope : 'selection'
  const payload = {
    kind: 'FOLDER-COMPARE-SELECTION-REPORT',
    scope,
    left: input.leftRoot,
    right: input.rightRoot,
    rows: input.rows,
  }

  if (format === 'json') {
    return `${JSON.stringify(payload, null, 2)}\n`
  }

  if (format === 'csv') {
    const header = 'relativePath,status,kind,ignored,leftPath,rightPath'
    const lines = input.rows.map((row) =>
      [
        csvEscape(row.relativePath),
        csvEscape(row.status),
        csvEscape(row.kind),
        row.ignored === true ? 'ignored' : '',
        csvEscape(row.leftPath ?? ''),
        csvEscape(row.rightPath ?? ''),
      ].join(','),
    )

    return [header, ...lines].join('\n')
  }

  if (format === 'xml') {
    const rowXml = input.rows
      .map((row) => {
        const ignored = row.ignored === true ? 'true' : 'false'

        return [
          '  <row>',
          `    <relativePath>${escapeXml(row.relativePath)}</relativePath>`,
          `    <status>${escapeXml(row.status)}</status>`,
          `    <kind>${escapeXml(row.kind)}</kind>`,
          `    <ignored>${ignored}</ignored>`,
          `    <leftPath>${escapeXml(row.leftPath ?? '')}</leftPath>`,
          `    <rightPath>${escapeXml(row.rightPath ?? '')}</rightPath>`,
          '  </row>',
        ].join('\n')
      })
      .join('\n')

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<folderCompareSelectionReport>',
      `  <scope>${escapeXml(scope)}</scope>`,
      `  <left>${escapeXml(input.leftRoot)}</left>`,
      `  <right>${escapeXml(input.rightRoot)}</right>`,
      rowXml,
      '</folderCompareSelectionReport>',
      '',
    ].join('\n')
  }

  // html
  const rowsHtml = input.rows
    .map((row) => {
      const ignored = row.ignored === true ? 'ignored' : ''

      return [
        '<tr>',
        `<td>${escapeHtml(row.relativePath)}</td>`,
        `<td>${escapeHtml(row.status)}</td>`,
        `<td>${escapeHtml(row.kind)}</td>`,
        `<td>${escapeHtml(ignored)}</td>`,
        `<td>${escapeHtml(row.leftPath ?? '')}</td>`,
        `<td>${escapeHtml(row.rightPath ?? '')}</td>`,
        '</tr>',
      ].join('')
    })
    .join('\n')

  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8" /><title>Folder Compare Selection Report</title></head>',
    '<body>',
    '<h1>Folder Compare Selection Report</h1>',
    `<p>scope: ${escapeHtml(scope)}</p>`,
    `<p>left: ${escapeHtml(input.leftRoot)}</p>`,
    `<p>right: ${escapeHtml(input.rightRoot)}</p>`,
    '<table border="1" cellpadding="4" cellspacing="0">',
    '<thead><tr><th>Path</th><th>Status</th><th>Kind</th><th>Ignored</th><th>Left</th><th>Right</th></tr></thead>',
    `<tbody>${rowsHtml}</tbody>`,
    '</table>',
    '</body></html>',
    '',
  ].join('\n')
}
