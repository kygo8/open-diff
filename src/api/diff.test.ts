import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyLiveRegistryValue,
  applyTextPatch,
  applyTextPatchToFile,
  changeFolderEntryAttributes,
  compareFolderPaths,
  setArchiveExtensions,
  compareHexFiles,
  compareMediaFiles,
  comparePictureFiles,
  compareRegistryExports,
  compareTable,
  compareTableCsv,
  compareVersionFiles,
  copyFolderCompareEntry,
  deleteFolderEntry,
  exportFolderCompareReport,
  exportTextCompareReport,
  findHexInFile,
  mergeTextFiles,
  createFolderSnapshot,
  moveFolderEntry,
  renameFolderEntry,
  saveHexEdits,
  saveTextFile,
  touchFolderEntry,
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
      createBackup: true,
      backupRetention: 1,
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

    expect(invoke).toHaveBeenCalledWith('compare_table', {
      left: 'SKU\nA-1',
      right: 'sku\nA-1',
      format: undefined,
      leftPath: undefined,
      rightPath: undefined,
      leftSheet: undefined,
      rightSheet: undefined,
      keyColumnIndices: undefined,
      ignoredColumns: undefined,
      manualMappings: undefined,
      delimiter: undefined,
      ignoreCase: true,
      firstRowIsHeader: true,
    })
    expect(result.columnMappings[0]?.leftColumn).toBe('SKU')
  })

  it('compares folder paths through the Tauri command contract', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      rows: [
        {
          relativePath: 'src/main.ts',
          depth: 1,
          status: 'Different',
          left: {
            name: 'main.ts',
            kind: 'file',
            size: 12,
            modifiedAtMs: 1,
            path: 'D:/left/src/main.ts',
          },
          right: {
            name: 'main.ts',
            kind: 'file',
            size: 14,
            modifiedAtMs: 2,
            path: 'D:/right/src/main.ts',
          },
        },
      ],
      summary: {
        total: 1,
        same: 0,
        different: 1,
        leftOnly: 0,
        rightOnly: 0,
      },
    })

    const result = await compareFolderPaths({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
    })

    expect(invoke).toHaveBeenCalledWith('compare_folder_paths', {
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      criteria: undefined,
      filters: undefined,
      archiveExtensions: undefined,
    })
    expect(result.rows[0]?.relativePath).toBe('src/main.ts')
  })

  it('syncs archive extensions to the compare engine', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(['.zip', '.7z'])
    const result = await setArchiveExtensions(['.zip', '7z'])

    expect(invoke).toHaveBeenCalledWith('set_archive_extensions', {
      extensions: ['.zip', '7z'],
    })
    expect(result).toEqual(['.zip', '.7z'])
  })

  it('runs folder compare file operations through the Tauri command contracts', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({
        direction: 'toRight',
        sourcePath: 'D:/left/src/main.ts',
        targetPath: 'D:/right/src/main.ts',
        targetMetadata: {
          kind: 'file',
          name: 'main.ts',
          extension: 'ts',
          size: 12,
          readonly: false,
          createdAtMs: 1,
          modifiedAtMs: 2,
          accessedAtMs: 3,
        },
        refreshedStatus: 'same',
      })
      .mockResolvedValueOnce({
        operation: 'rename',
        status: 'renamed',
        sourcePath: 'D:/right/src/main.ts',
        targetPath: 'D:/right/src/app.ts',
      })
      .mockResolvedValueOnce({
        operation: 'delete',
        status: 'deleted',
        sourcePath: 'D:/right/src/app.ts',
        targetPath: null,
      })
      .mockResolvedValueOnce({
        path: 'D:/right/README.md',
        metadata: { kind: 'file', name: 'README.md', size: 4, readonly: true },
      })
      .mockResolvedValueOnce({
        path: 'D:/right/README.md',
        metadata: { kind: 'file', name: 'README.md', size: 4, readonly: true },
      })

    await copyFolderCompareEntry({
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      relativePath: 'src/main.ts',
      direction: 'toRight',
    })
    await renameFolderEntry({ path: 'D:/right/src/main.ts', newName: 'app.ts' })
    await deleteFolderEntry({ path: 'D:/right/src/app.ts' })
    await changeFolderEntryAttributes({ path: 'D:/right/README.md', readonly: true })
    await touchFolderEntry({ path: 'D:/right/README.md', modifiedAtMs: 1782864000000 })

    expect(invoke).toHaveBeenNthCalledWith(1, 'copy_folder_compare_entry', {
      leftRoot: 'D:/left',
      rightRoot: 'D:/right',
      relativePath: 'src/main.ts',
      direction: 'toRight',
    })
    expect(invoke).toHaveBeenNthCalledWith(2, 'rename_folder_entry', {
      path: 'D:/right/src/main.ts',
      newName: 'app.ts',
    })
    expect(invoke).toHaveBeenNthCalledWith(3, 'delete_folder_entry', {
      path: 'D:/right/src/app.ts',
    })
    expect(invoke).toHaveBeenNthCalledWith(4, 'change_folder_entry_attributes', {
      path: 'D:/right/README.md',
      readonly: true,
    })
    expect(invoke).toHaveBeenNthCalledWith(5, 'touch_folder_entry', {
      path: 'D:/right/README.md',
      modifiedAtMs: 1782864000000,
    })
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

  it('compares hex files through the Tauri command contract', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      left: {
        path: 'C:/bin/left.bin',
        totalLen: 4,
        cells: [
          { offset: 0, byte: 65, hex: '41', ascii: 'A', different: false },
          { offset: 1, byte: 66, hex: '42', ascii: 'B', different: true },
        ],
      },
      right: {
        path: 'C:/bin/right.bin',
        totalLen: 4,
        cells: [
          { offset: 0, byte: 65, hex: '41', ascii: 'A', different: false },
          { offset: 1, byte: 88, hex: '58', ascii: 'X', different: true },
        ],
      },
      diffRanges: [{ offset: 1, leftBytes: [66], rightBytes: [88] }],
      summary: {
        leftBytes: 4,
        rightBytes: 4,
        differentRanges: 1,
      },
    })

    const result = await compareHexFiles({
      leftPath: 'C:/bin/left.bin',
      rightPath: 'C:/bin/right.bin',
      offset: 0,
      length: 64,
    })

    expect(invoke).toHaveBeenCalledWith('compare_hex_files', {
      leftPath: 'C:/bin/left.bin',
      rightPath: 'C:/bin/right.bin',
      offset: 0,
      length: 64,
    })
    expect(result.right.cells[1]?.hex).toBe('58')
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
      rgbTolerance: undefined,
      compareAlpha: undefined,
      alphaTolerance: undefined,
      ignoreColorFrom: undefined,
      ignoreColorTo: undefined,
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

  it('compares registry exports through the Tauri command contract', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      leftName: 'left.reg',
      rightName: 'right.reg',
      tree: [
        {
          path: 'HKCU/Software/OpenDiff',
          label: 'OpenDiff',
          status: 'modified',
          values: [
            {
              keyPath: 'HKCU/Software/OpenDiff',
              name: 'Theme',
              left: { kind: 'REG_SZ', data: 'dark' },
              right: { kind: 'REG_SZ', data: 'light' },
              status: 'modified',
            },
          ],
          children: [],
        },
      ],
      summary: {
        added: 0,
        removed: 0,
        modified: 1,
        unchanged: 0,
      },
    })

    const result = await compareRegistryExports({
      left: 'Windows Registry Editor Version 5.00',
      right: 'Windows Registry Editor Version 5.00',
      leftName: 'left.reg',
      rightName: 'right.reg',
    })

    expect(invoke).toHaveBeenCalledWith('compare_registry_exports', {
      left: 'Windows Registry Editor Version 5.00',
      right: 'Windows Registry Editor Version 5.00',
      leftName: 'left.reg',
      rightName: 'right.reg',
    })
    expect(result.tree[0]?.values[0]?.name).toBe('Theme')
  })

  it('applies a live registry value through the Tauri command', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      targetKey: 'HKCU\\Software\\OpenDiff',
      name: 'Theme',
      action: 'set',
    })

    await applyLiveRegistryValue({
      targetKey: 'HKCU\\Software\\OpenDiff',
      name: 'Theme',
      kind: 'REG_SZ',
      data: 'dark',
    })

    expect(invoke).toHaveBeenCalledWith('apply_live_registry_value', {
      targetKey: 'HKCU\\Software\\OpenDiff',
      name: 'Theme',
      kind: 'REG_SZ',
      data: 'dark',
    })
  })

  it('compares tables with format, sheets, keys, and mappings', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      leftColumns: [],
      rightColumns: [],
      columnMappings: [],
      rows: [],
      changedCells: [],
      summary: { rowCount: 0, changedRowCount: 0, changedCellCount: 0 },
    })

    await compareTable({
      left: '',
      right: '',
      format: 'xlsx',
      leftPath: 'C:/a.xlsx',
      rightPath: 'C:/b.xlsx',
      leftSheet: 'Sheet1',
      rightSheet: 'Sheet1',
      keyColumnIndices: [0, 1],
      ignoredColumns: ['Notes'],
      manualMappings: [{ leftColumn: 'SKU', rightColumn: 'sku' }],
    })

    expect(invoke).toHaveBeenCalledWith(
      'compare_table',
      expect.objectContaining({
        format: 'xlsx',
        leftPath: 'C:/a.xlsx',
        keyColumnIndices: [0, 1],
        ignoredColumns: ['Notes'],
      }),
    )
  })

  it('exports reports, merges text, pages hex, and applies patches', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({ format: 'html', content: '<html></html>', outputPath: 'out.html' })
      .mockResolvedValueOnce({ format: 'text', content: 'diff', outputPath: 'out.txt' })
      .mockResolvedValueOnce({
        left: { path: 'l', text: 'a' },
        right: { path: 'r', text: 'b' },
        conflicts: [],
      })
      .mockResolvedValueOnce([{ offset: 4, length: 2 }])
      .mockResolvedValueOnce({ bytesWritten: 1 })
      .mockResolvedValueOnce({ operation: 'move', status: 'moved' })
      .mockResolvedValueOnce({ text: 'patched', appliedHunks: 1, files: 1 })

    await exportTextCompareReport({
      left: 'a',
      right: 'b',
      format: 'html',
      outputPath: 'out.html',
    })
    await exportFolderCompareReport({
      leftRoot: 'L',
      rightRoot: 'R',
      format: 'text',
      outputPath: 'out.txt',
    })
    await mergeTextFiles({ leftPath: 'l', rightPath: 'r' })
    await findHexInFile({ path: 'bin', queryKind: 'hex', query: '41' })
    await saveHexEdits({ path: 'bin', edits: [{ offset: 0, value: 1 }] })
    await moveFolderEntry({ sourcePath: 'a', targetPath: 'b' })
    await applyTextPatch({ source: 'old', patch: 'diff' })
    await applyTextPatchToFile({
      sourcePath: 'C:/work/main.ts',
      patch: 'diff',
      outputPath: 'C:/work/main.patched.ts',
    })

    expect(invoke).toHaveBeenCalledWith('export_text_compare_report', expect.any(Object))
    expect(invoke).toHaveBeenCalledWith('export_folder_compare_report', expect.any(Object))
    expect(invoke).toHaveBeenCalledWith('merge_text_files', expect.any(Object))
    expect(invoke).toHaveBeenCalledWith('find_hex_in_file', expect.any(Object))
    expect(invoke).toHaveBeenCalledWith('save_hex_edits', expect.any(Object))
    expect(invoke).toHaveBeenCalledWith('move_folder_entry', expect.any(Object))
    expect(invoke).toHaveBeenCalledWith('apply_text_patch', { source: 'old', patch: 'diff' })
    expect(invoke).toHaveBeenCalledWith('apply_text_patch_to_file', {
      sourcePath: 'C:/work/main.ts',
      patch: 'diff',
      outputPath: 'C:/work/main.patched.ts',
    })
  })

  it('creates a folder snapshot through the Tauri command contract', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('/tmp/snap.json')

    await createFolderSnapshot({
      sourceRoot: 'D:/left',
      outputPath: '/tmp/snap.json',
      name: 'left-snap',
    })

    expect(invoke).toHaveBeenCalledWith('create_folder_snapshot', {
      sourceRoot: 'D:/left',
      outputPath: '/tmp/snap.json',
      name: 'left-snap',
    })
  })
})
