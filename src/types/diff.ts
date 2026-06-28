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

export interface TableCompareRequest {
  left: string
  right: string
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

export interface PictureCompareRequest {
  leftPath: string
  rightPath: string
}

export interface PictureSideSummary {
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
