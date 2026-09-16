import { describe, expect, it } from 'vitest'
import { buildCopyToOutputOverrides, resolveCopyToOutputAction } from './folderMergeCopyToOutput'
import type { FolderMergeSide } from '@/types/folderMerge'

function side(role: FolderMergeSide['role'], kind: FolderMergeSide['kind']): FolderMergeSide {
  return { role, kind }
}

describe('folderMergeCopyToOutput', () => {
  it('maps left-only and right-only rows to the matching plan copy verbs', () => {
    expect(
      resolveCopyToOutputAction({
        left: side('Left', 'File'),
        right: side('Right', 'Missing'),
      }),
    ).toBe('Copy left to output')

    expect(
      resolveCopyToOutputAction({
        left: side('Left', 'Missing'),
        right: side('Right', 'File'),
      }),
    ).toBe('Copy right to output')
  })

  it('prefers left when both sides are present and skips fully missing rows', () => {
    expect(
      resolveCopyToOutputAction({
        left: side('Left', 'File'),
        right: side('Right', 'File'),
      }),
    ).toBe('Copy left to output')

    expect(
      resolveCopyToOutputAction({
        left: side('Left', 'Missing'),
        right: side('Right', 'Missing'),
      }),
    ).toBeNull()
  })

  it('builds path overrides for applicable rows only', () => {
    expect(
      buildCopyToOutputOverrides([
        {
          path: 'left-only.txt',
          left: side('Left', 'File'),
          right: side('Right', 'Missing'),
        },
        {
          path: 'right-only.txt',
          left: side('Left', 'Missing'),
          right: side('Right', 'Directory'),
        },
        {
          path: 'gone.txt',
          left: side('Left', 'Missing'),
          right: side('Right', 'Missing'),
        },
      ]),
    ).toEqual([
      { relativePath: 'left-only.txt', action: 'Copy left to output' },
      { relativePath: 'right-only.txt', action: 'Copy right to output' },
    ])
  })
})
