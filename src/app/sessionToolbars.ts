/** Session toolbar layouts for compare views. */

export interface SessionToolbarCommand {
  id: string
  glyph: string
  labelKey: string
  enabled: boolean
  /** Pressed/toggle chrome for capture-like session toolbars. */
  active?: boolean
}

export const folderCompareToolbarOrder = [
  'home',
  'all',
  'diffs',
  'same',
  'structure',
  'minor',
  'rules',
  'sessions',
  'copy',
  'expand',
  'collapse',
  'select',
  'files',
  'refresh',
  'swap',
  'stop',
  'filters',
  'peek',
] as const

export const textCompareToolbarOrder = [
  'home',
  'sessions',
  'goto',
  'wrap',
  'all',
  'diffs',
  'same',
  'context',
  'minor',
  'rules',
  'format',
  'copy',
  'next-section',
  'prev-section',
  'swap',
  'reload',
] as const

export const hexCompareToolbarOrder = [
  'home',
  'all',
  'diffs',
  'same',
  'rules',
  'format',
  'sessions',
  'copy',
  'next-diff',
  'prev-diff',
  'swap',
  'reload',
] as const

export const tableCompareToolbarOrder = [
  'home',
  'all',
  'diffs',
  'same',
  'minor',
  'rules',
  'format',
  'sessions',
  'copy',
  'next-diff',
  'prev-diff',
  'swap',
  'reload',
] as const

export const pictureCompareToolbarOrder = [
  'home',
  'tol',
  'range',
  'blend',
  'minor',
  'rules',
  'format',
  'sessions',
  'swap',
  'reload',
  'meta',
] as const

export const registryCompareToolbarOrder = [
  'home',
  'all',
  'diffs',
  'same',
  'copy',
  'next-diff',
  'prev-diff',
  'swap',
  'reload',
  'expand',
  'collapse',
] as const

export const mediaCompareToolbarOrder = [
  'home',
  'all',
  'diffs',
  'same',
  'minor',
  'rules',
  'next-diff',
  'prev-diff',
  'swap',
  'reload',
  'play2',
] as const

export const versionCompareToolbarOrder = [
  'home',
  'all',
  'diffs',
  'same',
  'minor',
  'rules',
  'next-diff',
  'prev-diff',
  'swap',
  'reload',
] as const

export const textPatchToolbarOrder = ['home', 'next-section', 'prev-section'] as const

export const textMergeToolbarOrder = [
  'home',
  'all',
  'diffs',
  'same',
  'context',
  'minor',
  'same-ok',
  'favor-left',
  'favor-right',
  'rules',
  'format',
  'conflict',
  'left',
  'center',
  'right',
  'next-conflict',
  'prev-conflict',
  'swap',
  'reload',
] as const

export const clipboardCompareToolbarOrder = [
  'home',
  'capture',
  'compare',
  'swap',
  'reload',
] as const

export const folderSyncToolbarOrder = [
  'home',
  'minor',
  'expand',
  'collapse',
  'select',
  'refresh',
  'stop',
  'peek',
  'sync-now',
  'cancel',
  'accept',
] as const

export const folderMergeToolbarOrder = [
  'home',
  'all',
  'diffs',
  'same',
  'structure',
  'minor',
  'same-ok',
  'rules',
  'sessions',
  'merge',
  'to-output',
  'expand',
  'collapse',
  'select',
  'files',
  'refresh',
  'swap',
  'stop',
  'filters',
  'peek',
] as const

interface ToolbarMeta {
  glyph: string
  labelKey: string
}

const folderMeta: Record<(typeof folderCompareToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  all: { glyph: '*', labelKey: 'ui.all' },
  diffs: { glyph: '!=', labelKey: 'ui.diffs' },
  same: { glyph: '=', labelKey: 'ui.same' },
  structure: { glyph: 'S', labelKey: 'ui.structure' },
  minor: { glyph: '~', labelKey: 'ui.minor' },
  rules: { glyph: 'R', labelKey: 'ui.rules' },
  sessions: { glyph: 'S', labelKey: 'ui.sessions' },
  copy: { glyph: 'C', labelKey: 'ui.copy' },
  expand: { glyph: '+', labelKey: 'ui.expand' },
  collapse: { glyph: '-', labelKey: 'ui.collapse' },
  select: { glyph: 'V', labelKey: 'ui.select' },
  files: { glyph: 'F', labelKey: 'ui.files' },
  refresh: { glyph: 'R', labelKey: 'ui.refresh' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  stop: { glyph: 'X', labelKey: 'ui.stop' },
  filters: { glyph: 'F', labelKey: 'ui.filters' },
  peek: { glyph: 'P', labelKey: 'ui.peek' },
}

const textMeta: Record<(typeof textCompareToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  all: { glyph: '*', labelKey: 'ui.all' },
  diffs: { glyph: '!=', labelKey: 'ui.diffs' },
  same: { glyph: '=', labelKey: 'ui.same' },
  context: { glyph: 'C', labelKey: 'ui.context' },
  minor: { glyph: '~', labelKey: 'ui.minor' },
  rules: { glyph: 'R', labelKey: 'ui.rules' },
  format: { glyph: 'F', labelKey: 'ui.format' },
  sessions: { glyph: 'S', labelKey: 'ui.sessions' },
  goto: { glyph: '#', labelKey: 'ui.goToLine' },
  wrap: { glyph: 'W', labelKey: 'ui.wrap' },
  copy: { glyph: 'C', labelKey: 'ui.copy' },
  'next-section': { glyph: 'N', labelKey: 'ui.nextSection' },
  'prev-section': { glyph: 'P', labelKey: 'ui.prevSection' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  reload: { glyph: 'R', labelKey: 'ui.reload' },
}

const hexMeta: Record<(typeof hexCompareToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  all: { glyph: '*', labelKey: 'ui.all' },
  diffs: { glyph: '!=', labelKey: 'ui.diffs' },
  same: { glyph: '=', labelKey: 'ui.same' },
  rules: { glyph: 'R', labelKey: 'ui.rules' },
  format: { glyph: 'F', labelKey: 'ui.format' },
  sessions: { glyph: 'S', labelKey: 'ui.sessions' },
  copy: { glyph: 'C', labelKey: 'ui.copy' },
  'next-diff': { glyph: 'N', labelKey: 'ui.nextDiff' },
  'prev-diff': { glyph: 'P', labelKey: 'ui.prevDiff' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  reload: { glyph: 'R', labelKey: 'ui.reload' },
}

const tableMeta: Record<(typeof tableCompareToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  all: { glyph: '*', labelKey: 'ui.all' },
  diffs: { glyph: '!=', labelKey: 'ui.diffs' },
  same: { glyph: '=', labelKey: 'ui.same' },
  minor: { glyph: '~', labelKey: 'ui.minor' },
  rules: { glyph: 'R', labelKey: 'ui.rules' },
  format: { glyph: 'F', labelKey: 'ui.format' },
  sessions: { glyph: 'S', labelKey: 'ui.sessions' },
  copy: { glyph: 'C', labelKey: 'ui.copy' },
  'next-diff': { glyph: 'N', labelKey: 'ui.nextDiff' },
  'prev-diff': { glyph: 'P', labelKey: 'ui.prevDiff' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  reload: { glyph: 'R', labelKey: 'ui.reload' },
}

const pictureMeta: Record<(typeof pictureCompareToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  tol: { glyph: 'T', labelKey: 'ui.tol' },
  range: { glyph: 'G', labelKey: 'ui.range' },
  blend: { glyph: 'B', labelKey: 'ui.blend' },
  minor: { glyph: '~', labelKey: 'ui.minor' },
  rules: { glyph: 'R', labelKey: 'ui.rules' },
  format: { glyph: 'F', labelKey: 'ui.format' },
  sessions: { glyph: 'S', labelKey: 'ui.sessions' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  reload: { glyph: 'R', labelKey: 'ui.reload' },
  meta: { glyph: 'M', labelKey: 'ui.meta' },
}

const registryMeta: Record<(typeof registryCompareToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  all: { glyph: '*', labelKey: 'ui.all' },
  diffs: { glyph: '!=', labelKey: 'ui.diffs' },
  same: { glyph: '=', labelKey: 'ui.same' },
  copy: { glyph: 'C', labelKey: 'ui.copy' },
  'next-diff': { glyph: 'N', labelKey: 'ui.nextDiff' },
  'prev-diff': { glyph: 'P', labelKey: 'ui.prevDiff' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  reload: { glyph: 'R', labelKey: 'ui.reload' },
  expand: { glyph: '+', labelKey: 'ui.expand' },
  collapse: { glyph: '-', labelKey: 'ui.collapse' },
}

const mediaMeta: Record<(typeof mediaCompareToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  all: { glyph: '*', labelKey: 'ui.all' },
  diffs: { glyph: '!=', labelKey: 'ui.diffs' },
  same: { glyph: '=', labelKey: 'ui.same' },
  minor: { glyph: '~', labelKey: 'ui.minor' },
  rules: { glyph: 'R', labelKey: 'ui.rules' },
  'next-diff': { glyph: 'N', labelKey: 'ui.nextDiff' },
  'prev-diff': { glyph: 'P', labelKey: 'ui.prevDiff' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  reload: { glyph: 'R', labelKey: 'ui.reload' },
  play2: { glyph: 'P2', labelKey: 'ui.play2' },
}

const versionMeta: Record<(typeof versionCompareToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  all: { glyph: '*', labelKey: 'ui.all' },
  diffs: { glyph: '!=', labelKey: 'ui.diffs' },
  same: { glyph: '=', labelKey: 'ui.same' },
  minor: { glyph: '~', labelKey: 'ui.minor' },
  rules: { glyph: 'R', labelKey: 'ui.rules' },
  'next-diff': { glyph: 'N', labelKey: 'ui.nextDiff' },
  'prev-diff': { glyph: 'P', labelKey: 'ui.prevDiff' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  reload: { glyph: 'R', labelKey: 'ui.reload' },
}

const textMergeMeta: Record<(typeof textMergeToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  all: { glyph: '*', labelKey: 'ui.all' },
  diffs: { glyph: '!=', labelKey: 'ui.diffs' },
  same: { glyph: '=', labelKey: 'ui.same' },
  context: { glyph: 'C', labelKey: 'ui.context' },
  minor: { glyph: '~', labelKey: 'ui.minor' },
  'same-ok': { glyph: 'OK', labelKey: 'ui.sameOk' },
  'favor-left': { glyph: '<', labelKey: 'ui.favorLeft' },
  'favor-right': { glyph: '>', labelKey: 'ui.favorRight' },
  rules: { glyph: 'R', labelKey: 'ui.rules' },
  format: { glyph: 'F', labelKey: 'ui.format' },
  conflict: { glyph: '!', labelKey: 'ui.conflict' },
  left: { glyph: 'L', labelKey: 'ui.left' },
  center: { glyph: 'B', labelKey: 'ui.center' },
  right: { glyph: 'R', labelKey: 'ui.right' },
  'next-conflict': { glyph: 'N', labelKey: 'ui.nextConflict' },
  'prev-conflict': { glyph: 'P', labelKey: 'ui.previousConflict' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  reload: { glyph: 'R', labelKey: 'ui.reload' },
}

const textPatchMeta: Record<(typeof textPatchToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  'next-section': { glyph: 'N', labelKey: 'ui.nextSection' },
  'prev-section': { glyph: 'P', labelKey: 'ui.prevSection' },
}

const clipboardMeta: Record<(typeof clipboardCompareToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  capture: { glyph: 'V', labelKey: 'ui.captureClipboard' },
  compare: { glyph: '!=', labelKey: 'ui.compareSelected' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  reload: { glyph: 'R', labelKey: 'ui.reload' },
}

const folderSyncMeta: Record<(typeof folderSyncToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  minor: { glyph: '~', labelKey: 'ui.minor' },
  expand: { glyph: '+', labelKey: 'ui.expand' },
  collapse: { glyph: '-', labelKey: 'ui.collapse' },
  select: { glyph: 'V', labelKey: 'ui.select' },
  refresh: { glyph: 'R', labelKey: 'ui.refresh' },
  stop: { glyph: 'X', labelKey: 'ui.stop' },
  peek: { glyph: 'P', labelKey: 'ui.peek' },
  'sync-now': { glyph: '>', labelKey: 'ui.syncNow' },
  cancel: { glyph: 'X', labelKey: 'ui.cancel' },
  accept: { glyph: 'OK', labelKey: 'ui.accept' },
}

const folderMergeMeta: Record<(typeof folderMergeToolbarOrder)[number], ToolbarMeta> = {
  home: { glyph: 'H', labelKey: 'ui.home' },
  all: { glyph: '*', labelKey: 'ui.all' },
  diffs: { glyph: '!=', labelKey: 'ui.diffs' },
  same: { glyph: '=', labelKey: 'ui.same' },
  structure: { glyph: 'S', labelKey: 'ui.structure' },
  minor: { glyph: '~', labelKey: 'ui.minor' },
  'same-ok': { glyph: 'OK', labelKey: 'ui.sameOk' },
  rules: { glyph: 'R', labelKey: 'ui.rules' },
  sessions: { glyph: 'S', labelKey: 'ui.sessions' },
  merge: { glyph: 'M', labelKey: 'ui.merge' },
  'to-output': { glyph: 'O', labelKey: 'ui.toOutput' },
  expand: { glyph: '+', labelKey: 'ui.expand' },
  collapse: { glyph: '-', labelKey: 'ui.collapse' },
  select: { glyph: 'V', labelKey: 'ui.select' },
  files: { glyph: 'F', labelKey: 'ui.files' },
  refresh: { glyph: 'R', labelKey: 'ui.refresh' },
  swap: { glyph: '<>', labelKey: 'ui.swap' },
  stop: { glyph: 'X', labelKey: 'ui.stop' },
  filters: { glyph: 'F', labelKey: 'ui.filters' },
  peek: { glyph: 'P', labelKey: 'ui.peek' },
}

function buildToolbar<T extends string>(
  order: readonly T[],
  meta: Record<T, ToolbarMeta>,
  enabled: Partial<Record<T, boolean>>,
): SessionToolbarCommand[] {
  return order.map((id) => ({
    id,
    glyph: meta[id].glyph,
    labelKey: meta[id].labelKey,
    enabled: Boolean(enabled[id]),
  }))
}

export function buildFolderCompareToolbar(
  enabled: Partial<Record<(typeof folderCompareToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(folderCompareToolbarOrder, folderMeta, enabled)
}

export function buildTextCompareToolbar(
  enabled: Partial<Record<(typeof textCompareToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(textCompareToolbarOrder, textMeta, enabled)
}

export function buildHexCompareToolbar(
  enabled: Partial<Record<(typeof hexCompareToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(hexCompareToolbarOrder, hexMeta, enabled)
}

export function buildTableCompareToolbar(
  enabled: Partial<Record<(typeof tableCompareToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(tableCompareToolbarOrder, tableMeta, enabled)
}

export function buildPictureCompareToolbar(
  enabled: Partial<Record<(typeof pictureCompareToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(pictureCompareToolbarOrder, pictureMeta, enabled)
}

export function buildRegistryCompareToolbar(
  enabled: Partial<Record<(typeof registryCompareToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(registryCompareToolbarOrder, registryMeta, enabled)
}

export function buildMediaCompareToolbar(
  enabled: Partial<Record<(typeof mediaCompareToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(mediaCompareToolbarOrder, mediaMeta, enabled)
}

export function buildVersionCompareToolbar(
  enabled: Partial<Record<(typeof versionCompareToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(versionCompareToolbarOrder, versionMeta, enabled)
}

export function buildTextMergeToolbar(
  enabled: Partial<Record<(typeof textMergeToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(textMergeToolbarOrder, textMergeMeta, enabled)
}

export function buildTextPatchToolbar(
  enabled: Partial<Record<(typeof textPatchToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(textPatchToolbarOrder, textPatchMeta, enabled)
}

export function buildClipboardCompareToolbar(
  enabled: Partial<Record<(typeof clipboardCompareToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(clipboardCompareToolbarOrder, clipboardMeta, enabled)
}

export function buildFolderSyncToolbar(
  enabled: Partial<Record<(typeof folderSyncToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(folderSyncToolbarOrder, folderSyncMeta, enabled)
}

export function buildFolderMergeToolbar(
  enabled: Partial<Record<(typeof folderMergeToolbarOrder)[number], boolean>>,
): SessionToolbarCommand[] {
  return buildToolbar(folderMergeToolbarOrder, folderMergeMeta, enabled)
}

export function pathPairTitle(leftPath: string, rightPath: string): string {
  return `${pathBaseName(leftPath)} <--> ${pathBaseName(rightPath)}`
}

export function syncPathPairTitle(leftPath: string, rightPath: string): string {
  return `Update: ${pathPairTitle(leftPath, rightPath)}`
}

export function singlePathTitle(path: string): string {
  return pathBaseName(path)
}

/** Path-pair title that includes merge output when present. */
export function mergeSessionTitle(leftPath: string, rightPath: string, outputPath = ''): string {
  const hasPair = Boolean(leftPath || rightPath)
  const pair = hasPair ? pathPairTitle(leftPath || '—', rightPath || '—') : ''

  if (outputPath && pair) {
    return `${pair} → ${pathBaseName(outputPath)}`
  }

  if (outputPath) {
    return singlePathTitle(outputPath)
  }

  return pair
}

export function pathBaseName(path: string): string {
  const normalized = path.replaceAll('\\', '/').replace(/\/+$/, '')
  const parts = normalized.split('/').filter(Boolean)

  return parts.at(-1) ?? path
}
