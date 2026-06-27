import { describe, expect, it, vi } from 'vitest'
import { pickRecentPath } from './filePicker'

describe('pickRecentPath', () => {
  it('opens a file picker and records the selected file path', async () => {
    const open = vi.fn().mockResolvedValue('C:/work/left.txt')

    await expect(
      pickRecentPath({
        kind: 'file',
        history: [],
        open,
      }),
    ).resolves.toEqual({
      selected: { path: 'C:/work/left.txt', kind: 'file' },
      history: [{ path: 'C:/work/left.txt', kind: 'file' }],
    })

    expect(open).toHaveBeenCalledWith({ directory: false })
  })

  it('opens a folder picker and records the selected folder path', async () => {
    const open = vi.fn().mockResolvedValue('C:/work/project')

    await expect(
      pickRecentPath({
        kind: 'folder',
        history: [],
        open,
      }),
    ).resolves.toMatchObject({
      selected: { path: 'C:/work/project', kind: 'folder' },
    })

    expect(open).toHaveBeenCalledWith({ directory: true })
  })

  it('keeps history unchanged when selection is cancelled', async () => {
    const history = [{ path: 'C:/work/existing.txt', kind: 'file' as const }]
    const open = vi.fn().mockResolvedValue(null)

    await expect(
      pickRecentPath({
        kind: 'file',
        history,
        open,
      }),
    ).resolves.toEqual({
      selected: null,
      history,
    })
  })
})
