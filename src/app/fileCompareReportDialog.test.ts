import { describe, expect, it } from 'vitest'
import {
  canOpenFileCompareReport,
  defaultFileCompareReportDialogState,
  fileCompareReportFormatLabelKey,
  fileCompareReportFormats,
  fileCompareReportOutputPath,
  normalizeFileCompareReportFormat,
  normalizeFileCompareReportScope,
} from './fileCompareReportDialog'

describe('fileCompareReportDialog', () => {
  it('defaults to HTML full-scope and gates on compare results', () => {
    expect(defaultFileCompareReportDialogState()).toEqual({ format: 'html', scope: 'full' })
    expect(canOpenFileCompareReport(false)).toBe(false)
    expect(canOpenFileCompareReport(true)).toBe(true)
    expect(fileCompareReportFormats).toContain('csv')
    expect(fileCompareReportFormats).toContain('markdown')
  })

  it('normalizes format/scope and builds sibling output paths', () => {
    expect(normalizeFileCompareReportFormat('csv')).toBe('csv')
    expect(normalizeFileCompareReportFormat('nope')).toBe('html')
    expect(normalizeFileCompareReportScope('selection')).toBe('selection')
    expect(normalizeFileCompareReportScope('other')).toBe('full')
    expect(fileCompareReportOutputPath('D:/left/project', 'html', 'full')).toBe(
      'D:/left/folder-compare.html',
    )
    expect(fileCompareReportOutputPath('D:/left/project', 'text', 'selection')).toBe(
      'D:/left/folder-compare-selection.txt',
    )
    expect(fileCompareReportOutputPath('', 'json', 'full')).toBe('folder-compare.json')
    expect(fileCompareReportFormatLabelKey('markdown')).toBe('ui.reportFormatMarkdown')
  })
})
