/** Honest script automation command catalogs for Reports/Scripts. */

export const supportedScriptCommands = [
  'LOAD',
  'FILTER',
  'COMPARE',
  'TEXT-REPORT',
  'FOLDER-REPORT',
  'FILE-REPORT',
  'REPORT',
  'HEX-REPORT',
  'TABLE-REPORT',
  'DATA-REPORT',
  'PICTURE-REPORT',
  'VERSION-REPORT',
  'REGISTRY-REPORT',
  'MEDIA-REPORT',
  'FOLDER-SYNC-REPORT',
  'SYNC-REPORT',
  'FOLDER-MERGE-REPORT',
  'MERGE-REPORT',
  'ARCHIVE-REPORT',
  'LIST-ARCHIVE',
  'LOG',
  'BEEP',
  'OPTION',
  'SET',
  'SELECT',
  'COPY',
  'COPYTO',
  'MOVE',
  'MOVETO',
  'DELETE',
  'RENAME',
  'TOUCH',
  'ATTRIB',
  'EXPAND',
  'COLLAPSE',
  'SNAPSHOT',
  'SYNC',
  'CRITERIA',
  'EXIT',
  'CLOSE',
  'VIEW',
  'ALIGN',
  'WAIT',
  'SLEEP',
  'PAUSE',
  'EXPAND-ALL',
  'COLLAPSE-ALL',
  'MERGE',
  'MKDIR',
  'ECHO',
  'IF',
  'ELSE',
  'ENDIF',
  'CALL',
  'INCLUDE',
  'REM',
  'CD',
  'FOLDER-COMPARE',
  'FILE-COMPARE',
  'DATA-COMPARE',
  'NAME-FILTER',
] as const

export const unsupportedScriptCommands = [] as const

export type SupportedScriptCommand = (typeof supportedScriptCommands)[number]
export type UnsupportedScriptCommand = (typeof unsupportedScriptCommands)[number]

export function formatCommandList(commands: readonly string[]): string {
  return commands.join(', ')
}

export const compareReportExampleScript = [
  `load "\${left}"`,
  `load "\${right}"`,
  'compare',
  `text-report "\${output}"`,
  `hex-report "\${output}.hex.txt"`,
  `folder-report "\${output}.folder.txt"`,
  `folder-sync-report "\${output}.sync.txt"`,
  `media-report "\${output}.media.txt"`,
  `picture-report "\${output}.picture.txt"`,
].join('\n')

export interface SampleScript {
  id: string
  titleKey: string
  source: string
}

export const folderSyncExampleScript = [
  `load "\${left}"`,
  `load "\${right}"`,
  'compare',
  'sync updateRight',
  `folder-sync-report "\${output}.sync.txt"`,
].join('\n')

export const waitLogExampleScript = [
  'echo start',
  'view side-by-side',
  'wait 10',
  'echo done',
].join('\n')

export const ifElseExampleScript = [
  'echo start',
  'if true',
  'echo branch-true',
  'else',
  'echo branch-false',
  'endif',
  'rem control flow sample',
].join('\n')

export const sampleScripts: SampleScript[] = [
  {
    id: 'text-report',
    titleKey: 'ui.scriptSampleTextReport',
    source: compareReportExampleScript,
  },
  {
    id: 'folder-sync',
    titleKey: 'ui.scriptSampleFolderSync',
    source: folderSyncExampleScript,
  },
  {
    id: 'wait-log',
    titleKey: 'ui.scriptSampleWaitLog',
    source: waitLogExampleScript,
  },
  {
    id: 'if-else',
    titleKey: 'ui.scriptSampleIfElse',
    source: ifElseExampleScript,
  },
]
