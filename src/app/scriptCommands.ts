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
