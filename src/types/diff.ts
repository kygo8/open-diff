export type DiffLineKind = 'equal' | 'added' | 'deleted' | 'modified'

export interface DiffLine {
  leftNumber: number | null
  rightNumber: number | null
  leftText: string
  rightText: string
  kind: DiffLineKind
  inlineSegments: InlineDiffSegments
  important?: boolean
}

export interface InlineDiffSegments {
  left: InlineDiffSegment[]
  right: InlineDiffSegment[]
}

export interface InlineDiffSegment {
  text: string
  changed: boolean
}

export interface TextDiffRequest {
  left: string
  right: string
  algorithm?: TextDiffAlgorithm
  ignoreWhitespace?: boolean
  ignoreCase?: boolean
  ignoreLineEndings?: boolean
  ignoreRegexes?: string[]
}

export type TextDiffAlgorithm = 'myers' | 'patience' | 'histogram'

export interface TextDiffResponse {
  lines: DiffLine[]
  stats: {
    added: number
    deleted: number
    modified: number
    equal: number
  }
}

export interface ReadTextFileResponse {
  path: string
  text: string
  encoding: string
  lineEnding: string
  fileStamp: FileStamp
}

export interface SaveTextFileRequest {
  path: string
  text: string
  createBackup?: boolean
  backupRetention?: number
}

export interface SaveTextFileResponse {
  path: string
  bytesWritten: number
  backupPath: string | null
  fileStamp: FileStamp
}

export interface FileStamp {
  size: number
  modifiedAtMs: number
}

export interface PathVolumeInfo {
  path: string
  freeBytes: number
  displayRoot: string
}

export interface TextPatchResponse {
  files: PatchFile[]
}

export interface PatchFile {
  oldPath: string
  newPath: string
  hunks: PatchHunk[]
}

export interface PatchHunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  heading: string
  lines: PatchLine[]
}

export interface PatchLine {
  kind: PatchLineKind
  oldNumber: number | null
  newNumber: number | null
  text: string
}

export type PatchLineKind = 'context' | 'added' | 'removed'

export interface TableManualColumnMapping {
  leftColumn?: string
  rightColumn?: string
}

export interface TableCompareRequest {
  left: string
  right: string
  format?: 'csv' | 'tsv' | 'html' | 'xlsx' | 'xls'
  leftPath?: string
  rightPath?: string
  leftSheet?: string
  rightSheet?: string
  keyColumnIndices?: number[]
  ignoredColumns?: string[]
  manualMappings?: TableManualColumnMapping[]
  delimiter?: string
  ignoreCase?: boolean
  firstRowIsHeader?: boolean
}

export interface TableCompareColumn {
  name: string
  side: 'left' | 'right'
}

export interface TableCompareColumnMapping {
  leftColumn?: string
  rightColumn?: string
  source: 'Automatic' | 'Manual' | 'Left Only' | 'Right Only'
}

export interface TableCompareRow {
  index: number
  leftCells: string[]
  rightCells: string[]
  status: string
}

export interface TableCompareChangedCell {
  rowIndex: number
  columnIndex: number
  leftValue?: string
  rightValue?: string
  status: string
}

export interface TableCompareResponse {
  leftColumns: TableCompareColumn[]
  rightColumns: TableCompareColumn[]
  columnMappings: TableCompareColumnMapping[]
  rows: TableCompareRow[]
  changedCells: TableCompareChangedCell[]
  summary: {
    rowCount: number
    changedRowCount: number
    changedCellCount: number
  }
  leftSheets?: string[]
  rightSheets?: string[]
  leftSheet?: string
  rightSheet?: string
}

export interface FolderCompareCriteria {
  compareSize: boolean
  compareModifiedTime: boolean
  compareContents: boolean
  compareCrc: boolean
  /** Compare readonly attributes; attribute-only diffs surface as Minor. */
  compareAttributes?: boolean
  /** Size-only metadata diffs surface as Minor when enabled. */
  sizeOnlyUnimportant?: boolean
  followSymlinks?: boolean
  /** Allowed absolute modified-time skew in milliseconds. */
  timestampToleranceMs?: number
  /** Treat a one-hour modified-time skew as equal (DST / clock skew). */
  ignoreDaylightSavingHourOffset?: boolean
  /** Include dotfile / hidden-name entries in Folder Compare. */
  showHiddenFiles?: boolean
  /** Align folder names with case sensitivity (off = case-insensitive match). */
  caseSensitiveNames?: boolean
}

export interface FolderNameFilters {
  include: string[]
  exclude: string[]
  caseSensitive?: boolean
}

export interface FolderCompareRequest {
  leftRoot: string
  rightRoot: string
  criteria?: FolderCompareCriteria
  filters?: FolderNameFilters
  archiveExtensions?: string[]
}

export type FolderCompareStatus = 'Same' | 'Different' | 'Left only' | 'Right only'

export interface FolderCompareSideEntry {
  name: string
  kind: 'file' | 'directory'
  size: number
  modifiedAtMs?: number
  path: string
}

export interface FolderCompareRow {
  relativePath: string
  depth: number
  status: FolderCompareStatus
  /** Timestamp/attribute/size-only difference — Folder Compare Minor filter. */
  unimportant?: boolean
  left?: FolderCompareSideEntry
  right?: FolderCompareSideEntry
}

export interface FolderCompareSummary {
  total: number
  same: number
  different: number
  leftOnly: number
  rightOnly: number
}

export interface FolderCompareResponse {
  leftRoot: string
  rightRoot: string
  rows: FolderCompareRow[]
  summary: FolderCompareSummary
}

export type FolderCopyDirection = 'toLeft' | 'toRight'

export interface FolderCompareCopyRequest {
  leftRoot: string
  rightRoot: string
  relativePath: string
  direction: FolderCopyDirection
}

export interface FolderEntryMetadata {
  kind: 'file' | 'directory'
  name: string
  extension?: string
  size: number
  readonly: boolean
  createdAtMs?: number
  modifiedAtMs?: number
  accessedAtMs?: number
}

export interface FolderCompareCopyResponse {
  direction: FolderCopyDirection
  sourcePath: string
  targetPath: string
  targetMetadata: FolderEntryMetadata
  refreshedStatus: 'unknown' | 'same' | 'different' | 'leftOnly' | 'rightOnly' | 'error'
}

export type FolderFileOperationKind = 'move' | 'copy' | 'delete' | 'rename' | 'createFolder'
export type FolderFileOperationStatus = 'moved' | 'copied' | 'deleted' | 'renamed' | 'created'

export interface FolderFileOperationResponse {
  operation: FolderFileOperationKind
  status: FolderFileOperationStatus
  sourcePath: string
  targetPath: string | null
}

export interface RenameFolderEntryRequest {
  path: string
  newName: string
}

export interface DeleteFolderEntryRequest {
  path: string
}

export interface CreateFolderEntryRequest {
  path: string
}

export interface ChangeFolderEntryAttributesRequest {
  path: string
  readonly?: boolean
}

export interface TouchFolderEntryRequest {
  path: string
  modifiedAtMs: number
}

export interface FolderMetadataUpdateResponse {
  path: string
  metadata: FolderEntryMetadata
}

export interface MediaCompareRequest {
  leftPath: string
  rightPath: string
}

export interface MediaStreamSummary {
  codec: string
  sampleRate: string
  channels: string
  bitrate: string
}

export interface MediaSideSummary {
  name: string
  container: string
  duration: string
  stream: MediaStreamSummary
}

export type MediaFieldStatus = 'added' | 'removed' | 'modified' | 'unchanged'

export interface MediaFieldRow {
  field: string
  left?: string
  right?: string
  status: MediaFieldStatus
}

export interface MediaCompareResponse {
  left: MediaSideSummary
  right: MediaSideSummary
  fields: MediaFieldRow[]
  summary: Record<MediaFieldStatus, number>
}

export interface HexCompareRequest {
  leftPath: string
  rightPath: string
  /** Decimal number or decimal/hex string for offsets past Number.MAX_SAFE_INTEGER. */
  offset?: number | string
  length?: number
}

export interface HexViewCell {
  offset: number | string
  byte: number
  hex: string
  ascii: string
  different: boolean
}

export interface HexSideWindow {
  path: string
  totalLen: number
  cells: HexViewCell[]
}

export interface HexDiffRange {
  offset: number | string
  leftBytes: number[]
  rightBytes: number[]
}

export interface HexCompareResponse {
  left: HexSideWindow
  right: HexSideWindow
  diffRanges: HexDiffRange[]
  summary: {
    leftBytes: number
    rightBytes: number
    differentRanges: number
  }
}

export interface PictureCompareRequest {
  leftPath: string
  rightPath: string
  rgbTolerance?: number
  compareAlpha?: boolean
  alphaTolerance?: number
  ignoreColorFrom?: number[]
  ignoreColorTo?: number[]
}

export interface PictureSideSummary {
  path?: string
  name: string
  format: string
  dimensions: string
  colorDepth: string
}

export interface PictureMetadataRow {
  key: string
  label: string
  left: string
  right: string
  status: 'different' | 'equal'
}

export interface PictureCompareResponse {
  left: PictureSideSummary
  right: PictureSideSummary
  statistics: {
    totalPixels: number
    differentPixels: number
    differenceRatio: number
    boundingRect?: {
      x: number
      y: number
      width: number
      height: number
    }
  }
  metadataRows: PictureMetadataRow[]
}

export interface RegistryCompareRequest {
  left: string
  right: string
  leftName?: string
  rightName?: string
}

export interface RegistryLiveCompareRequest {
  leftKey: string
  rightKey: string
  leftName?: string
  rightName?: string
}

export interface RegistryHiveCompareRequest {
  leftPath: string
  rightPath: string
  leftRoot?: string
  rightRoot?: string
  leftName?: string
  rightName?: string
}

export type RegistryDiffStatus = 'added' | 'removed' | 'modified' | 'unchanged'

export interface RegistryValueSide {
  kind: string
  data: string
}

export interface RegistryValueRow {
  keyPath: string
  name: string
  status: RegistryDiffStatus
  left?: RegistryValueSide
  right?: RegistryValueSide
}

export interface RegistryKeyNode {
  path: string
  label: string
  status: RegistryDiffStatus
  values: RegistryValueRow[]
  children: RegistryKeyNode[]
}

export interface RegistryCompareResponse {
  leftName: string
  rightName: string
  tree: RegistryKeyNode[]
  summary: Record<RegistryDiffStatus, number>
}

export interface ApplyLiveRegistryValueRequest {
  targetKey: string
  name: string
  kind?: string
  data?: string
}

export interface ApplyLiveRegistryValueResponse {
  targetKey: string
  name: string
  action: 'set' | 'delete'
}

export interface VersionCompareRequest {
  leftPath: string
  rightPath: string
}

export type VersionFieldStatus = 'added' | 'removed' | 'modified' | 'unchanged'

export interface VersionSideSummary {
  name: string
  fileType: string
  targetOs: string
  fileVersion: string
  productVersion: string
}

export interface VersionFieldRow {
  field: string
  group: 'Fixed Info' | 'String Info'
  left?: string
  right?: string
  status: VersionFieldStatus
}

export interface VersionCompareResponse {
  left: VersionSideSummary
  right: VersionSideSummary
  fields: VersionFieldRow[]
  summary: Record<VersionFieldStatus, number>
}

export interface TextMergeConflictRow {
  lineIndex: number
  title: string
  base: string
  left: string
  right: string
  outputSpan: number
}

export interface TextMergeRequest {
  leftPath: string
  rightPath: string
  centerPath?: string
  outputPath?: string
  conflictPolicy?: 'markConflict' | 'favorLeft' | 'favorRight'
}

export interface TextMergeResponse {
  leftPath: string
  rightPath: string
  centerPath?: string
  outputPath?: string
  leftText: string
  rightText: string
  centerText: string
  outputText: string
  conflicts: TextMergeConflictRow[]
}

export interface ExportReportRequest {
  format:
    'html' | 'html-side-by-side' | 'text' | 'json' | 'xml' | 'csv' | 'markdown' | 'tsv' | 'yaml'
  outputPath?: string
}

export interface ExportTextCompareReportRequest extends ExportReportRequest {
  left: string
  right: string
  leftSource?: string
  rightSource?: string
  algorithm?: TextDiffAlgorithm
  ignoreWhitespace?: boolean
  ignoreCase?: boolean
  ignoreLineEndings?: boolean
  ignoreRegexes?: string[]
}

export interface ExportFolderCompareReportRequest extends ExportReportRequest {
  leftRoot: string
  rightRoot: string
  /** When false, identical rows are omitted from the exported report. */
  includeIdentical?: boolean
}

export interface ExportReportResponse {
  format: string
  content: string
  outputPath?: string
  bytesWritten?: number
}

export interface HexFindRequest {
  path: string
  queryKind: 'text' | 'hex'
  query: string
}

export interface HexFindMatch {
  offset: number | string
  length: number
}

export interface HexByteEdit {
  offset: number | string
  value: number
}

export interface HexSaveRequest {
  path: string
  edits: HexByteEdit[]
  createBackup?: boolean
  backupRetention?: number
}

export interface HexSaveResult {
  bytesWritten: number
  backupPath?: string
}

export interface CopyFolderEntryRequest {
  sourcePath: string
  targetPath: string
  preserveTimestamps?: boolean
  overwriteReadOnly?: boolean
  sourceModifiedAtMs?: number
}

export interface MoveFolderEntryRequest {
  sourcePath: string
  targetPath: string
}

export interface ApplyTextPatchRequest {
  source: string
  patch: string
}

export interface ApplyTextPatchToFileRequest {
  sourcePath: string
  patch: string
  outputPath?: string
}

export interface ApplyTextPatchResponse {
  text: string
  appliedHunks: number
  files: number
}
