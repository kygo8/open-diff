export type DiffLineKind = 'equal' | 'added' | 'deleted' | 'modified'

export interface DiffLine {
  leftNumber: number | null
  rightNumber: number | null
  leftText: string
  rightText: string
  kind: DiffLineKind
}

export interface TextDiffRequest {
  left: string
  right: string
}

export interface TextDiffResponse {
  lines: DiffLine[]
  stats: {
    added: number
    deleted: number
    modified: number
    equal: number
  }
}
