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
  home: { kind: 'plate', plate: 'home', symbol: '⌂' },
  sessions: { kind: 'plate', plate: 'sessions', symbol: '▣' },
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
  stop: { kind: 'plate', plate: 'stop', symbol: '■' },
  peek: { kind: 'plate', plate: 'peek', symbol: '◉' },
  'sync-now': { kind: 'plate', plate: 'sync-now', symbol: '▶' },
  accept: { kind: 'plate', plate: 'accept', symbol: '✓' },
  cancel: { kind: 'plate', plate: 'cancel', symbol: '✕' },
  merge: { kind: 'plate', plate: 'merge', symbol: '⑂' },
  'same-ok': { kind: 'plate', plate: 'same-ok', symbol: '✓' },
  'to-output': { kind: 'plate', plate: 'to-output', symbol: '⇢' },
  select: { kind: 'plate', plate: 'select', symbol: '☑' },
  all: { kind: 'plate', plate: 'all', symbol: '✱' },
  diffs: { kind: 'plate', plate: 'diffs', symbol: '≠' },
  same: { kind: 'plate', plate: 'same', symbol: '=' },
  structure: { kind: 'plate', plate: 'structure', symbol: '▤' },
  minor: { kind: 'plate', plate: 'minor', symbol: '~' },
  files: { kind: 'plate', plate: 'files', symbol: '▤' },
  // Pass 2+3: OpenDiff plates for capture MainBar slots (no proprietary bitmaps)
  context: { kind: 'plate', plate: 'context', symbol: '☰' },
  format: { kind: 'plate', plate: 'format', symbol: '¶' },
  font: { kind: 'plate', plate: 'font', symbol: 'A' },
  goto: { kind: 'plate', plate: 'goto', symbol: '#' },
  wrap: { kind: 'plate', plate: 'wrap', symbol: '↩' },
  'favor-left': { kind: 'plate', plate: 'favor-left', symbol: '◀' },
  'favor-right': { kind: 'plate', plate: 'favor-right', symbol: '▶' },
  conflict: { kind: 'plate', plate: 'conflict', symbol: '⚔' },
  left: { kind: 'plate', plate: 'left', symbol: '◁' },
  center: { kind: 'plate', plate: 'center', symbol: '▣' },
  right: { kind: 'plate', plate: 'right', symbol: '▷' },
  capture: { kind: 'plate', plate: 'capture', symbol: '⊕' },
  compare: { kind: 'plate', plate: 'compare', symbol: '≠' },
  tol: { kind: 'plate', plate: 'tol', symbol: '±' },
  range: { kind: 'plate', plate: 'range', symbol: '⟷' },
  blend: { kind: 'plate', plate: 'blend', symbol: '◐' },
  meta: { kind: 'plate', plate: 'meta', symbol: '◈' },
  play2: { kind: 'plate', plate: 'play2', symbol: '⏵' },
  edit: { kind: 'plate', plate: 'edit', symbol: '✎' },
  undo: { kind: 'plate', plate: 'undo', symbol: '↶' },
  redo: { kind: 'plate', plate: 'redo', symbol: '↷' },
  cut: { kind: 'plate', plate: 'cut', symbol: '✂' },
  paste: { kind: 'plate', plate: 'paste', symbol: '⤵' },
  delete: { kind: 'plate', plate: 'delete', symbol: '⌫' },
  syntax: { kind: 'plate', plate: 'syntax', symbol: '{}' },
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
  // Clipboard Compare leftovers (plates preferred when showToolbarIcons)
  capture: ClipboardPlus,
  compare: Diff,
  // Picture Compare leftovers
  tol: CircleGauge,
  range: SlidersHorizontal,
  blend: Blend,
  meta: Tag,
  // Text Edit / optional edit chrome
  edit: SquarePen,
  undo: Undo2,
  redo: Redo2,
  cut: Scissors,
  paste: ClipboardPaste,
  delete: Trash2,
  syntax: BookType,
}

/**
 * Capture MainBar spacing (~6px CSS / 12px PNG group gaps on folder/text shots): mark commands that
 * start a visual group so the shell can insert separator rhythm without PNGs.
 */
export const sessionToolbarSeparatorBeforeIds: ReadonlySet<string> = new Set([
  'all',
  'minor',
  'structure',
  'context',
  'same-ok',
  'rules',
  'merge',
  'to-output',
  'copy',
  'expand',
  'swap',
  'filters',
  'peek',
  'sync-now',
  'cancel',
  'accept',
  'sessions',
  'goto',
  'wrap',
  'next-diff',
  'next-section',
  'next-conflict',
  'reload',
  'favor-left',
  'conflict',
  'left',
  'capture',
  'tol',
  'play2',
  'meta',
  'font',
  'undo',
  'syntax',
])

export function sessionToolbarHasSeparatorBefore(
  id: string,
  previousId: string | undefined,
): boolean {
  if (!previousId) {
    return false
  }

  // Capture Text/Folder MainBar: Home+Sessions cluster, then hairline before All/filters.
  if (previousId === 'home') {
    return id !== 'sessions'
  }

  if (previousId === 'sessions' || previousId === 'goto' || previousId === 'wrap') {
    return id === 'all' || id === 'undo' || id === 'next-section' || id === 'tol'
  }

  // Pass 3: measured capture MainBar 0px-gap clusters (ui-capture.json rects).
  const adjacentPairs: readonly (readonly [string, string])[] = [
    ['minor', 'context'],
    ['format', 'rules'],
    ['range', 'tol'],
    ['blend', 'range'],
    ['same-ok', 'minor'],
    ['favor-left', 'same-ok'],
    ['favor-right', 'favor-left'],
    ['to-output', 'merge'],
    ['peek', 'filters'],
    ['reload', 'swap'],
    ['play2', 'reload'],
    ['left', 'conflict'],
    ['center', 'left'],
    ['right', 'center'],
    ['font', 'syntax'],
    ['copy', 'cut'],
    ['paste', 'copy'],
    ['delete', 'paste'],
    ['redo', 'undo'],
    ['cut', 'redo'],
  ]

  for (const [next, prev] of adjacentPairs) {
    if (id === next && previousId === prev) {
      return false
    }
  }

  return sessionToolbarSeparatorBeforeIds.has(id)
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
