export interface InvokeCall {
  command: string
  args: unknown
}

export const invokeCalls: InvokeCall[] = []

export function lastInvoke(command: string): InvokeCall | undefined {
  return [...invokeCalls].reverse().find((call) => call.command === command)
}

export function invokeArgs(command: string): Record<string, unknown> {
  const call = lastInvoke(command)

  if (!call || typeof call.args !== 'object' || call.args === null) {
    throw new Error(`expected invoke('${command}') to have been called with an object`)
  }

  return call.args as Record<string, unknown>
}

export function resetInvokeCalls(): void {
  invokeCalls.length = 0
}

export function invokeResponse(command: string, args: Record<string, unknown> = {}): unknown {
  switch (command) {
    case 'diff_text':
      return {
        lines: [],
        stats: { added: 0, deleted: 0, modified: 0, equal: 0 },
      }
    case 'read_text_file': {
      const path = typeof args.path === 'string' ? args.path : 'file.txt'

      return {
        path,
        text: `loaded:${path}`,
        encoding: 'UTF-8',
        lineEnding: 'LF',
        fileStamp: { size: 8, modifiedAtMs: 1 },
      }
    }
    case 'save_text_file': {
      const text = typeof args.text === 'string' ? args.text : ''

      return {
        path: typeof args.path === 'string' ? args.path : 'file.txt',
        bytesWritten: text.length,
        backupPath: null,
        fileStamp: { size: 8, modifiedAtMs: 1 },
      }
    }
    case 'compare_folder_paths':
      return {
        leftRoot: args.leftRoot ?? '',
        rightRoot: args.rightRoot ?? '',
        rows: [],
        summary: { total: 0, same: 0, different: 0, leftOnly: 0, rightOnly: 0 },
      }
    case 'preview_folder_sync':
      return {
        name: 'preview',
        leftRoot: args.leftRoot ?? '',
        rightRoot: args.rightRoot ?? '',
        strategy: args.strategy ?? 'updateBoth',
        rows: [
          {
            id: 'copy-readme',
            relativePath: 'readme.txt',
            action: 'Copy',
            sourcePath: `${String(args.leftRoot)}/readme.txt`,
            targetPath: `${String(args.rightRoot)}/readme.txt`,
            detail: 'Left only',
          },
        ],
        summary: { total: 1, copy: 1, delete: 0, leave: 0, conflict: 0 },
      }
    case 'execute_folder_sync':
      return {
        name: 'run',
        leftRoot: args.leftRoot ?? '',
        rightRoot: args.rightRoot ?? '',
        strategy: args.strategy ?? 'updateBoth',
        total: 1,
        succeeded: 1,
        failed: 0,
        cancelled: 0,
        logs: [],
      }
    case 'build_folder_merge_plan':
      return {
        leftRoot: args.leftRoot ?? '',
        baseRoot: args.baseRoot ?? '',
        rightRoot: args.rightRoot ?? '',
        outputRoot: args.outputRoot ?? '',
        rows: [
          {
            id: 'conflict-txt',
            path: 'conflict.txt',
            action: 'Mark conflict',
            detail: 'Left and right changed the same path differently',
            base: { role: 'Base', kind: 'File', size: '3 B' },
            left: { role: 'Left', kind: 'File', size: '4 B' },
            right: { role: 'Right', kind: 'File', size: '5 B' },
            conflict: {
              path: 'conflict.txt',
              reason: 'Left and right changed the same path differently',
              baseContext: 'Base: File',
              leftContext: 'Left: File',
              rightContext: 'Right: File',
            },
          },
        ],
        summary: { actions: 1, automatic: 0, conflicts: 1 },
      }
    case 'execute_folder_merge_plan':
      return {
        outputRoot: args.outputRoot ?? '',
        rows: [],
        summary: { total: 1, executed: 0, skipped: 0, conflicts: 1, failed: 0 },
      }
    case 'merge_text_files':
      return {
        leftPath: args.leftPath,
        rightPath: args.rightPath,
        centerPath: args.centerPath,
        outputPath: args.outputPath,
        leftText: 'left loaded',
        rightText: 'right loaded',
        centerText: 'center loaded',
        outputText: 'merged loaded',
        conflicts: [],
      }
    case 'compare_table':
      return {
        leftColumns: [],
        rightColumns: [],
        columnMappings: [],
        rows: [],
        changedCells: [],
        leftSheet: 'Sheet1',
        rightSheet: 'Sheet1',
        summary: { rowCount: 0, changedRowCount: 0, changedCellCount: 0 },
      }
    case 'compare_hex_files':
      return {
        left: { path: args.leftPath, totalLen: 0, cells: [] },
        right: { path: args.rightPath, totalLen: 0, cells: [] },
        diffRanges: [],
        summary: { leftBytes: 0, rightBytes: 0, differentRanges: 0 },
      }
    case 'compare_picture_files':
      return {
        left: { name: 'left.png', format: 'PNG', dimensions: '1 x 1', colorDepth: '32-bit' },
        right: { name: 'right.png', format: 'PNG', dimensions: '1 x 1', colorDepth: '32-bit' },
        statistics: {
          totalPixels: 1,
          differentPixels: 0,
          differenceRatio: 0,
          boundingRect: { x: 0, y: 0, width: 1, height: 1 },
        },
        metadataRows: [],
      }
    case 'compare_registry_exports':
      return {
        leftName: args.leftName ?? 'left.reg',
        rightName: args.rightName ?? 'right.reg',
        tree: [],
        summary: { added: 0, deleted: 0, modified: 0, same: 0 },
      }
    case 'apply_live_registry_value':
      return {
        targetKey: args.targetKey ?? '',
        name: args.name ?? '',
        action: args.kind ? 'set' : 'delete',
      }
    case 'compare_media_files':
      return {
        left: {
          name: 'left.mp3',
          container: 'MP3',
          duration: '00:00.000',
          stream: { codec: 'MP3', sampleRate: 'Unknown', channels: 'Unknown', bitrate: 'Unknown' },
        },
        right: {
          name: 'right.mp3',
          container: 'MP3',
          duration: '00:00.000',
          stream: { codec: 'MP3', sampleRate: 'Unknown', channels: 'Unknown', bitrate: 'Unknown' },
        },
        fields: [],
        summary: { added: 0, removed: 0, modified: 0, unchanged: 0 },
      }
    case 'compare_version_files':
      return {
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
          fileVersion: '1.0.0.1',
          productVersion: '1.0.0.0',
        },
        fields: [],
        summary: { added: 0, removed: 0, modified: 0, unchanged: 0 },
      }
    case 'parse_text_patch':
      return { file: 'file.txt', hunks: [] }
    case 'apply_text_patch':
    case 'apply_text_patch_to_file':
      return { text: 'patched' }
    case 'export_text_compare_report':
    case 'export_folder_compare_report':
      return {
        format: args.format ?? 'html',
        content: '<html></html>',
        outputPath: args.outputPath ?? 'report.html',
        bytesWritten: 13,
      }
    case 'run_script':
      return {
        executed: 1,
        compared: 1,
        different: 0,
        reportsWritten: 1,
        logs: ['ok'],
        cancelled: false,
      }
    case 'stop_script':
      return true
    case 'list_remote_profiles':
      return []
    case 'save_remote_profile':
    case 'delete_remote_profile':
      return []
    case 'test_remote_profile':
      return 'connected'
    case 'list_remote_path': {
      const remotePath = typeof args.path === 'string' ? args.path : '/'
      const prefix = remotePath === '/' ? '' : remotePath

      return [
        { path: `${prefix}/docs`, kind: 'directory', size: 0 },
        { path: `${prefix}/readme.txt`, kind: 'file', size: 12 },
      ]
    }
    case 'write_git_integration':
    case 'write_svn_integration':
      return 'Wrote config'
    case 'register_windows_shell_extension':
    case 'unregister_windows_shell_extension':
      return { windows: false, applied: false, script: '', message: 'Windows only' }
    case 'register_unix_shell_integration':
    case 'unregister_unix_shell_integration':
      return { windows: false, applied: true, script: '', message: 'unix shell ok' }
    case 'open_path_external':
      return {
        path: args.path ?? '',
        executable: args.executable ?? null,
        launched: true,
      }
    case 'reveal_path_in_os':
      return {
        path: args.path ?? '',
        selected: true,
        fallbackOpened: false,
        launched: true,
      }
    case 'take_shell_compare_launch':
      return null
    case 'load_admin_policy':
      return { savePasswords: true, remoteProfiles: true, updateChecks: true }
    case 'app_runtime_info':
      return { os: 'linux', family: 'unix' }
    case 'path_file_stamp': {
      const path = typeof args.path === 'string' ? args.path : 'file.bin'

      return {
        size: Math.max(1, path.length * 8),
        modifiedAtMs: Date.UTC(2026, 0, 15, 8, 30),
      }
    }
    case 'path_volume_info':
      return {
        path: args.path ?? '',
        freeBytes: 91.8 * 1024 ** 3,
        displayRoot: 'C:\\',
      }
    case 'move_folder_entry':
    case 'copy_folder_entry':
    case 'rename_folder_entry':
    case 'delete_folder_entry':
    case 'copy_folder_compare_entry':
      return { operation: command, status: 'ok' }
    default:
      return {}
  }
}

export function convertFileSrc(path: string): string {
  return path
}
