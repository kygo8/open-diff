export type DiffLineKind = 'equal' | 'added' | 'deleted' | 'modified'

export interface DiffLine {
  leftNumber: number | null
  rightNumber: number | null
  leftText: string
  rightText: string
  kind: DiffLineKind
  inlineSegments: InlineDiffSegments
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
