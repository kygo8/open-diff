export interface TextMergeReportConflict {
  line: number
  title: string
  resolved: boolean
  base: string
  left: string
  right: string
}

export interface BuildTextMergeReportTextInput {
  leftPath: string
  rightPath: string
  centerPath: string
  outputPath: string
  conflictPolicy: string
  outputLineCount: number
  conflicts: TextMergeReportConflict[]
}

/** Sibling text report path next to the merge output (matches folder/hex export style). */
export function defaultTextMergeReportOutputPath(outputPath: string): string {
  const trimmed = outputPath.trim()

  if (!trimmed) {
    return 'text-merge-report.txt'
  }

  const slash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))

  if (slash < 0) {
    return 'text-merge-report.txt'
  }

  return `${trimmed.slice(0, slash + 1)}text-merge-report.txt`
}

export function buildTextMergeReportText(input: BuildTextMergeReportTextInput): string {
  const unresolved = input.conflicts.filter((conflict) => !conflict.resolved).length
  const lines = [
    'TEXT-MERGE-REPORT',
    `left: ${input.leftPath}`,
    `right: ${input.rightPath}`,
    `center: ${input.centerPath}`,
    `output: ${input.outputPath}`,
    `conflictPolicy: ${input.conflictPolicy}`,
    `outputLines: ${String(input.outputLineCount)}`,
    `conflicts: ${String(input.conflicts.length)}`,
    `unresolved: ${String(unresolved)}`,
    '',
    'conflicts:',
    ...input.conflicts.map((conflict) => {
      const state = conflict.resolved ? 'resolved' : 'open'

      return `${String(conflict.line)}\t${state}\t${conflict.title}\t${conflict.left}\t${conflict.base}\t${conflict.right}`
    }),
  ]

  return `${lines.join('\n')}\n`
}
