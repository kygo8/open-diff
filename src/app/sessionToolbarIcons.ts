/** Session toolbar visuals: denser CSS plates + Lucide icons (presentation only). */

import {
  ArrowDownToLine,
  ArrowLeftFromLine,
  ArrowLeftRight,
  ArrowRightFromLine,
  ArrowUpToLine,
  Asterisk,
  Blend,
  BookType,
  Briefcase,
  Check,
  CircleGauge,
  CircleX,
  ClipboardPaste,
  ClipboardPlus,
  Copy,
  Diff,
  Equal,
  EqualApproximately,
  Eye,
  FileStack,
  FileType,
  FoldVertical,
  Funnel,
  GitMerge,
  Hash,
  Home,
  ListChecks,
  ListTree,
  Play,
  PlayCircle,
  Redo2,
  RefreshCw,
  RotateCw,
  Rows2,
  Scale,
  Scissors,
  SlidersHorizontal,
  SquarePen,
  Tag,
  TextWrap,
  Trash2,
  Type,
  Undo2,
  UnfoldVertical,
  X,
  type LucideIcon,
} from '@lucide/vue'

/** Compact tinted plate drawn in the toolbar (denser than outline icons). */
export interface SessionToolbarPlate {
  kind: 'plate'
  /** CSS `data-plate` key for tinted chrome. */
  plate: string
  /** Short symbol rendered inside the plate. */
  symbol: string
}

export type SessionToolbarVisual = { kind: 'icon'; icon: LucideIcon } | SessionToolbarPlate

/**
 * Prefer filled/compact CSS glyph plates for high-traffic capture actions.
 * Symbols are original unicode — not copied from third-party icon assets.
 */
export const sessionToolbarPlates: Readonly<Record<string, SessionToolbarPlate>> = {
  refresh: { kind: 'plate', plate: 'refresh', symbol: '↻' },
  reload: { kind: 'plate', plate: 'reload', symbol: '⟳' },
  swap: { kind: 'plate', plate: 'swap', symbol: '↔' },
  copy: { kind: 'plate', plate: 'copy', symbol: '⧉' },
  'copy-left': { kind: 'plate', plate: 'copy-left', symbol: '◧' },
  'copy-right': { kind: 'plate', plate: 'copy-right', symbol: '◨' },
  'next-diff': { kind: 'plate', plate: 'next', symbol: '▾' },
  'prev-diff': { kind: 'plate', plate: 'prev', symbol: '▴' },
  'next-section': { kind: 'plate', plate: 'next', symbol: '▾' },
  'prev-section': { kind: 'plate', plate: 'prev', symbol: '▴' },
  'next-conflict': { kind: 'plate', plate: 'next', symbol: '▾' },
  'prev-conflict': { kind: 'plate', plate: 'prev', symbol: '▴' },
  expand: { kind: 'plate', plate: 'expand', symbol: '⤢' },
  collapse: { kind: 'plate', plate: 'collapse', symbol: '⤡' },
  filters: { kind: 'plate', plate: 'filters', symbol: '▽' },
  rules: { kind: 'plate', plate: 'rules', symbol: '⚖' },
}

/**
 * Lucide map for ids that keep outline icons (or plate fallbacks via plates map).
 * Unknown ids fall back to the letter glyph in the shell — do not invent misleading icons.
 */
export const sessionToolbarIcons: Readonly<Record<string, LucideIcon>> = {
  home: Home,
  sessions: Briefcase,
  all: Asterisk,
  diffs: Diff,
  same: Equal,
  structure: ListTree,
  context: Rows2,
  minor: EqualApproximately,
  rules: Scale,
  format: FileType,
  font: Type,
  goto: Hash,
  wrap: TextWrap,
  copy: Copy,
  expand: UnfoldVertical,
  collapse: FoldVertical,
  select: ListChecks,
  files: FileStack,
  refresh: RefreshCw,
  swap: ArrowLeftRight,
  stop: CircleX,
  filters: Funnel,
  peek: Eye,
  'next-section': ArrowDownToLine,
  'prev-section': ArrowUpToLine,
  'next-diff': ArrowDownToLine,
  'prev-diff': ArrowUpToLine,
  reload: RotateCw,
  'sync-now': Play,
  cancel: X,
  accept: Check,
  'same-ok': Check,
  merge: GitMerge,
  'to-output': ArrowRightFromLine,
  play2: PlayCircle,
  'favor-left': ArrowLeftFromLine,
  'favor-right': ArrowRightFromLine,
  'next-conflict': ArrowDownToLine,
  'prev-conflict': ArrowUpToLine,
  conflict: GitMerge,
  left: ArrowLeftFromLine,
  center: Rows2,
  right: ArrowRightFromLine,
  // Clipboard Compare letter-glyph leftovers
  capture: ClipboardPlus,
  compare: Diff,
  // Picture Compare letter-glyph leftovers
  tol: CircleGauge,
  range: SlidersHorizontal,
  blend: Blend,
  meta: Tag,
  // Text Edit / general edit chrome
  edit: SquarePen,
  undo: Undo2,
  redo: Redo2,
  cut: Scissors,
  paste: ClipboardPaste,
  delete: Trash2,
  syntax: BookType,
}

export function plateForSessionToolbarCommand(id: string): SessionToolbarPlate | undefined {
  return Object.hasOwn(sessionToolbarPlates, id) ? sessionToolbarPlates[id] : undefined
}

export function iconForSessionToolbarCommand(id: string): LucideIcon | undefined {
  return Object.hasOwn(sessionToolbarIcons, id) ? sessionToolbarIcons[id] : undefined
}

/**
 * Prefer a CSS glyph plate when defined; otherwise a Lucide icon.
 * Callers honor showToolbarIcons — return undefined only when neither exists.
 */
export function visualForSessionToolbarCommand(id: string): SessionToolbarVisual | undefined {
  const plate = plateForSessionToolbarCommand(id)

  if (plate) {
    return plate
  }

  const icon = iconForSessionToolbarCommand(id)

  if (icon) {
    return { kind: 'icon', icon }
  }

  return undefined
}
