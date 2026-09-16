/** Compact folder-session status legend vocabulary (Same / Different / Orphans / Ignored / Minor). */

export type FolderLegendTone = 'same' | 'different' | 'orphan' | 'ignored' | 'minor'

export interface FolderLegendItem {
  id: FolderLegendTone
  labelKey: string
  descriptionKey: string
  tone: FolderLegendTone
}

export const folderStatusLegendItems: readonly FolderLegendItem[] = [
  {
    id: 'same',
    labelKey: 'ui.same',
    descriptionKey: 'ui.legendSameDescription',
    tone: 'same',
  },
  {
    id: 'different',
    labelKey: 'ui.different',
    descriptionKey: 'ui.legendDifferentDescription',
    tone: 'different',
  },
  {
    id: 'orphan',
    labelKey: 'ui.orphans',
    descriptionKey: 'ui.legendOrphanDescription',
    tone: 'orphan',
  },
  {
    id: 'ignored',
    labelKey: 'ui.ignored',
    descriptionKey: 'ui.legendIgnoredDescription',
    tone: 'ignored',
  },
  {
    id: 'minor',
    labelKey: 'ui.minor',
    descriptionKey: 'ui.legendMinorDescription',
    tone: 'minor',
  },
] as const
