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
