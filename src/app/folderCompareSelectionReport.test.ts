import { describe, expect, it } from 'vitest'
import {
  buildFolderCompareSelectionReportContent,
  buildFolderCompareSelectionReportText,
  defaultFolderCompareSelectionReportOutputPath,
} from './folderCompareSelectionReport'

describe('folderCompareSelectionReport', () => {
  it('builds a sibling selection report path and selection-scoped text', () => {
    expect(defaultFolderCompareSelectionReportOutputPath('D:/left/project')).toBe(
      'D:/left/folder-compare-selection.txt',
    )
    expect(defaultFolderCompareSelectionReportOutputPath('')).toBe('folder-compare-selection.txt')

    const text = buildFolderCompareSelectionReportText({
      leftRoot: '/left',
      rightRoot: '/right',
      scopeLabel: 'checked',
      rows: [
        {
          relativePath: 'src/a.ts',
          status: 'Different',
          kind: 'file',
          leftPath: '/left/src/a.ts',
          rightPath: '/right/src/a.ts',
          ignored: true,
        },
        {
          relativePath: 'docs',
          status: 'Same',
          kind: 'directory',
          leftPath: '/left/docs',
          rightPath: '/right/docs',
        },
      ],
    })

    expect(text).toContain('FOLDER-COMPARE-SELECTION-REPORT')
    expect(text).toContain('scope: checked')
    expect(text).toContain('selected: 2')
    expect(text).toContain('files: 1')
    expect(text).toContain('directories: 1')
    expect(text).toContain('ignored: 1')
    expect(text).toContain('src/a.ts\tDifferent\tfile\tignored\t/left/src/a.ts\t/right/src/a.ts')
  })
})

it('serializes selection rows for json, csv, and html formats', () => {
  const input = {
    leftRoot: '/left',
    rightRoot: '/right',
    scopeLabel: 'selection',
    rows: [
      {
        relativePath: 'a.ts',
        status: 'Different',
        kind: 'file' as const,
        leftPath: '/left/a.ts',
        rightPath: '/right/a.ts',
      },
    ],
  }

  expect(buildFolderCompareSelectionReportContent('json', input)).toContain(
    '"kind": "FOLDER-COMPARE-SELECTION-REPORT"',
  )
  expect(buildFolderCompareSelectionReportContent('csv', input)).toContain(
    'relativePath,status,kind',
  )
  expect(buildFolderCompareSelectionReportContent('html', input)).toContain('<table')
  expect(buildFolderCompareSelectionReportContent('markdown', input)).toContain(
    '# Folder Compare Selection Report',
  )
})
