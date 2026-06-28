import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  compareMediaFiles,
  comparePictureFiles,
  compareTableCsv,
  compareVersionFiles,
  saveTextFile,
} from './diff'
import { invoke } from '@tauri-apps/api/core'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({
    path: 'D:/workspace/output.txt',
    bytesWritten: 12,
    backupPath: null,
    fileStamp: { size: 12, modifiedAtMs: 1 },
  }),
}))

describe('diff api', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear()
  })

  it('saves text files through the Tauri command contract', async () => {
    const result = await saveTextFile({
      path: 'D:/workspace/output.txt',
      text: 'merged text',
    })

    expect(invoke).toHaveBeenCalledWith('save_text_file', {
      path: 'D:/workspace/output.txt',
      text: 'merged text',
    })
    expect(result.bytesWritten).toBe(12)
  })

  it('compares CSV table content through the Tauri command contract', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      leftColumns: [{ name: 'SKU', side: 'left' }],
      rightColumns: [{ name: 'sku', side: 'right' }],
      columnMappings: [
        {
          leftColumn: 'SKU',
          rightColumn: 'sku',
          source: 'Automatic',
        },
      ],
      rows: [
        {
          index: 0,
          leftCells: ['A-1'],
          rightCells: ['A-1'],
          status: 'Same',
        },
      ],
      changedCells: [],
      summary: {
        rowCount: 1,
        changedRowCount: 0,
        changedCellCount: 0,
      },
    })

    const result = await compareTableCsv({
      left: 'SKU\nA-1',
      right: 'sku\nA-1',
    })

    expect(invoke).toHaveBeenCalledWith('compare_table_csv', {
      left: 'SKU\nA-1',
      right: 'sku\nA-1',
    })
    expect(result.columnMappings[0]?.leftColumn).toBe('SKU')
  })

  it('compares media files through the Tauri command contract', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      left: {
        name: 'left.mp3',
        container: 'MP3',
        duration: '00:00.000',
        stream: {
          codec: 'MP3',
          sampleRate: 'Unknown',
          channels: 'Unknown',
          bitrate: 'Unknown',
        },
      },
      right: {
        name: 'right.mp3',
        container: 'MP3',
        duration: '00:00.000',
        stream: {
          codec: 'MP3',
          sampleRate: 'Unknown',
          channels: 'Unknown',
          bitrate: 'Unknown',
        },
      },
      fields: [
        {
          field: 'Title',
          left: 'Left Song',
          right: 'Right Song',
          status: 'modified',
        },
      ],
      summary: {
        added: 0,
        removed: 0,
        modified: 1,
        unchanged: 0,
      },
    })

    const result = await compareMediaFiles({
      leftPath: 'C:/music/left.mp3',
      rightPath: 'C:/music/right.mp3',
    })

    expect(invoke).toHaveBeenCalledWith('compare_media_files', {
      leftPath: 'C:/music/left.mp3',
      rightPath: 'C:/music/right.mp3',
    })
    expect(result.fields[0]?.status).toBe('modified')
  })

  it('compares picture files through the Tauri command contract', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      left: {
        name: 'left.png',
        format: 'PNG',
        dimensions: '2 x 1',
        colorDepth: '32-bit',
      },
      right: {
        name: 'right.png',
        format: 'PNG',
        dimensions: '2 x 1',
        colorDepth: '32-bit',
      },
      statistics: {
        totalPixels: 2,
        differentPixels: 1,
        differenceRatio: 0.5,
        boundingRect: {
          x: 1,
          y: 0,
          width: 1,
          height: 1,
        },
      },
      metadataRows: [],
    })

    const result = await comparePictureFiles({
      leftPath: 'C:/images/left.png',
      rightPath: 'C:/images/right.png',
    })

    expect(invoke).toHaveBeenCalledWith('compare_picture_files', {
      leftPath: 'C:/images/left.png',
      rightPath: 'C:/images/right.png',
    })
    expect(result.statistics.differentPixels).toBe(1)
  })

  it('compares version files through the Tauri command contract', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      left: {
        name: 'left.exe',
        fileType: 'Application',
        targetOs: 'Windows 32-bit',
        fileVersion: '1.0.0.0',
        productVersion: '1.0.0.0',
      },
      right: {
        name: 'right.exe',
        fileType: 'Application',
        targetOs: 'Windows 32-bit',
        fileVersion: '1.1.0.0',
        productVersion: '1.0.0.0',
      },
      fields: [
        {
          field: 'FileVersion',
          group: 'Fixed Info',
          left: '1.0.0.0',
          right: '1.1.0.0',
          status: 'modified',
        },
      ],
      summary: {
        added: 0,
        removed: 0,
        modified: 1,
        unchanged: 0,
      },
    })

    const result = await compareVersionFiles({
      leftPath: 'C:/apps/left.exe',
      rightPath: 'C:/apps/right.exe',
    })

    expect(invoke).toHaveBeenCalledWith('compare_version_files', {
      leftPath: 'C:/apps/left.exe',
      rightPath: 'C:/apps/right.exe',
    })
    expect(result.fields[0]?.field).toBe('FileVersion')
  })
})
