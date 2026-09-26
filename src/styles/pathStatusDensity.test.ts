import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const pathPair = readFileSync(resolve(root, 'src/components/workbench/PathPairBar.vue'), 'utf8')
const pathActions = readFileSync(
  resolve(root, 'src/components/workbench/SessionPathActions.vue'),
  'utf8',
)
const pathMeta = readFileSync(resolve(root, 'src/components/workbench/PathMetaFooter.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')
const pictureView = readFileSync(resolve(root, 'src/views/PictureCompareView.vue'), 'utf8')
const mediaView = readFileSync(resolve(root, 'src/views/MediaCompareView.vue'), 'utf8')
const tableView = readFileSync(resolve(root, 'src/views/TableCompareView.vue'), 'utf8')
const registryView = readFileSync(resolve(root, 'src/views/RegistryCompareView.vue'), 'utf8')
const versionView = readFileSync(resolve(root, 'src/views/VersionCompareView.vue'), 'utf8')
const hexView = readFileSync(resolve(root, 'src/views/HexCompareView.vue'), 'utf8')
const textEditView = readFileSync(resolve(root, 'src/views/TextEditView.vue'), 'utf8')
const textMergeView = readFileSync(resolve(root, 'src/views/TextMergeView.vue'), 'utf8')
const textPatchView = readFileSync(resolve(root, 'src/views/TextPatchView.vue'), 'utf8')
const clipboardView = readFileSync(resolve(root, 'src/views/ClipboardCompareView.vue'), 'utf8')
const folderSyncView = readFileSync(resolve(root, 'src/views/FolderSyncView.vue'), 'utf8')
const folderMergeView = readFileSync(resolve(root, 'src/views/FolderMergeView.vue'), 'utf8')
const folderCompareView = readFileSync(resolve(root, 'src/views/FolderCompareView.vue'), 'utf8')
const textMergeViewForFooter = readFileSync(resolve(root, 'src/views/TextMergeView.vue'), 'utf8')

describe('path/status strip density', () => {
  it('keeps path bars and footers at capture CSS scale', () => {
    expect(css).toMatch(/\.bc-path-row\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.bc-path-row input\s*\{[\s\S]*?height:\s*20px/)
    expect(css).toMatch(/\.path-pair-bar\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.path-pair-field span\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.path-pair-swap\s*\{[\s\S]*?width:\s*20px/)
    expect(css).toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*11px/)
    expect(css).toMatch(/\.path-side-footer\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.path-side-footer\s*\{[\s\S]*?line-height:\s*16px/)
    expect(css).not.toMatch(/\.path-side-footer\s*\{[\s\S]*?font-size:\s*6px/)
  })

  it('sizes path action glyphs to capture 23x22', () => {
    expect(pathActions).toMatch(/\.bc-path-action\s*\{[\s\S]*?width:\s*23px/)
    expect(pathActions).toMatch(/\.bc-path-action\s*\{[\s\S]*?height:\s*22px/)
    expect(css).toMatch(/\.bc-path-row \.bc-path-action[\s\S]*?width:\s*23px/)
    expect(css).toMatch(/\.bc-path-row \.bc-path-action[\s\S]*?height:\s*22px/)
  })

  it('uses icon-only browse/save path actions toward capture chrome', () => {
    expect(pathActions).toMatch(/FolderOpen/)
    expect(pathActions).toMatch(/ChevronDown/)
    expect(pathActions).toMatch(/Save/)
    expect(pathActions).toMatch(/Archive/)
    expect(pathActions).toMatch(/height:\s*22px/)
    expect(pathActions).not.toMatch(/\{\{\s*t\('ui\.browse'\)\s*\}\}/)
    expect(pathPair).toMatch(/SessionPathActions/)
    expect(pathPair).not.toMatch(/\{\{\s*t\('ui\.browse'\)\s*\}\}/)
    expect(css).toMatch(/\.bc-path-row \.bc-path-action/)
  })

  it('keeps path meta footers with capture timestamp/size/encoding chips', () => {
    expect(pathMeta).toMatch(/data-path-meta-density="capture-1to1"/)
    expect(pathMeta).toMatch(/path-meta-modified/)
    expect(pathMeta).toMatch(/path-meta-size/)
    expect(pathMeta).toMatch(/path-meta-chip/)
    expect(pathMeta).toMatch(/path-meta-eol/)
    expect(pathMeta).toMatch(/min-height:\s*16px/)
    expect(pathMeta).toMatch(/font-size:\s*11px/)
    expect(pathMeta).toMatch(/\.path-meta-chip\s*\{[\s\S]*?height:\s*16px/)
    expect(pathMeta).toMatch(/\.path-meta-chip\s*\{[\s\S]*?padding:\s*0 4px/)
    expect(pathMeta).toMatch(/\.path-meta-footer\s*\{[\s\S]*?gap:\s*6px/)
    expect(pathMeta).toMatch(/:size="12"/)
    expect(pathMeta).toMatch(/ChevronDown/)
    expect(pathMeta).toMatch(/buildPathFooterMeta/)
    expect(pathMeta).toMatch(/aria-haspopup="listbox"/)
    expect(pathMeta).toMatch(/path-meta-chip-menu/)
    expect(pathMeta).not.toMatch(/tabindex="-1"/)
    expect(css).toMatch(/\.bc-path-footers \.path-meta-chip[\s\S]*?height:\s*16px/)
  })

  it('keeps shared status strip near capture ~19.5px CSS height', () => {
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='folder-pair'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(layout).toMatch(
      /\.status-bar\[data-chrome-kind='text-session'\][\s\S]*?height:\s*19\.5px/,
    )
    expect(layout).toMatch(
      /\.app-shell-dense-chrome:has\(\.status-bar\[data-chrome-kind='folder-pair'\]\)[\s\S]*?grid-template-rows:\s*23\.5px minmax\(0, 1fr\) 19\.5px/,
    )
  })

  it('rolls shared path actions/footers onto Picture/Media/Table/Registry/Version', () => {
    for (const source of [
      pictureView,
      mediaView,
      tableView,
      registryView,
      versionView,
      hexView,
      textEditView,
      textMergeView,
      textPatchView,
    ]) {
      expect(source).toMatch(/SessionPathActions/)
    }
    for (const source of [
      pictureView,
      mediaView,
      tableView,
      registryView,
      versionView,
      hexView,
      textEditView,
      textPatchView,
      clipboardView,
    ]) {
      expect(source).toMatch(/PathMetaFooter/)
    }
  })

  it('finishes Folder archive/browse and Folder Compare/Sync/Merge path footers on shared chrome', () => {
    expect(folderCompareView).toMatch(/show-archive/)
    expect(folderCompareView).toMatch(/folder-browse-archive-left/)
    expect(folderCompareView).not.toMatch(/bc-path-action-text/)
    expect(folderCompareView).toMatch(/PathMetaFooter/)
    expect(folderSyncView).toMatch(/SessionPathActions/)
    expect(folderSyncView).toMatch(/PathMetaFooter/)
    expect(folderMergeView).toMatch(/SessionPathActions/)
    expect(folderMergeView).toMatch(/PathMetaFooter/)
    expect(textMergeViewForFooter).toMatch(/PathMetaFooter/)
    expect(textMergeViewForFooter).toMatch(/merge-path-footers/)
  })

  it('fuses path row corners and borders into the shell frame', () => {
    expect(css).toMatch(/\.bc-path-row input\s*\{[\s\S]*?border-radius:\s*0/)
    expect(css).toMatch(/\.path-pair input,[\s\S]*?border-radius:\s*0/)
    expect(css).toMatch(/\.bc-path-row button\s*\{[\s\S]*?border-radius:\s*0/)
    expect(css).toMatch(/\.bc-path-row button\s*\{[\s\S]*?border:\s*1px solid #a0a0a0/)
    expect(css).toMatch(/\.path-pair-bar input\s*\{[\s\S]*?border-radius:\s*0/)
    expect(css).toMatch(
      /\.app-shell-single-session \.folder-toolbar \.path-pair\s*\{[\s\S]*?min-height:\s*20px/,
    )
  })
})

describe('PathMetaFooter MIX/EOL residual', () => {
  it('keeps EOL/MIX chip chrome at capture footer density', () => {
    expect(pathMeta).toMatch(/data-path-meta-eol="capture-1to1-residual"/)
    expect(pathMeta).toMatch(/data-eol-kind/)
    expect(pathMeta).toMatch(/\.path-meta-eol\s*\{[\s\S]*?height:\s*16px/)
    expect(pathMeta).toMatch(/\.path-meta-eol\s*\{[\s\S]*?font-weight:\s*600/)
    expect(css).toMatch(
      /\.path-meta-footer\[data-path-meta-eol='capture-1to1-residual'\] \.path-meta-eol[\s\S]*?height:\s*16px/,
    )
  })
})

describe('PathMetaFooter chip spacing residual', () => {
  it('tightens MIX/EOL/chip spacing toward capture footer density', () => {
    expect(pathMeta).toMatch(/data-path-meta-gap="capture-1to1-residual"/)
    expect(pathMeta).toMatch(/\.path-meta-footer\s*\{[\s\S]*?gap:\s*6px/)
    expect(pathMeta).toMatch(/\.path-meta-footer\s*\{[\s\S]*?min-height:\s*16px/)
    expect(pathMeta).toMatch(/\.path-meta-chip\s*\{[\s\S]*?border:\s*1px solid transparent/)
    expect(css).toMatch(
      /\.path-meta-footer\[data-path-meta-gap='capture-1to1-residual'\][\s\S]*?gap:\s*6px/,
    )
    expect(css).toMatch(/\.bc-path-footers \.path-meta-footer[\s\S]*?gap:\s*6px/)
  })
})

describe('path-meta-eol border', () => {
  it('matches capture EOL chip border #c0c0c0', () => {
    expect(css).toMatch(
      /\.path-meta-footer\[data-path-meta-eol='capture-1to1-residual'\] \.path-meta-eol[\s\S]*?border:\s*1px solid #c0c0c0/,
    )
  })
})

describe('path-meta-eol fill', () => {
  it('matches capture EOL chip fill #f0f0f0', () => {
    expect(css).toMatch(
      /\.path-meta-footer\[data-path-meta-eol='capture-1to1-residual'\] \.path-meta-eol[\s\S]*?background:\s*#f0f0f0/,
    )
  })
})

describe('folder path-pair fill', () => {
  it('matches capture folder path-pair fill #f0f0f0', () => {
    expect(css).toMatch(
      /\.app-shell-single-session \.folder-toolbar \.path-pair\s*\{[\s\S]*?background:\s*#f0f0f0/,
    )
  })
})

describe('path-meta-eol base chrome', () => {
  it('matches capture EOL chip base fill and border', () => {
    expect(pathMeta).toMatch(/\.path-meta-eol\s*\{[\s\S]*?border:\s*1px solid #c0c0c0/)
    expect(pathMeta).toMatch(/\.path-meta-eol\s*\{[\s\S]*?background:\s*#f0f0f0/)
  })
})

describe('bc-path-row fill', () => {
  it('matches capture bc-path-row fill #f0f0f0', () => {
    expect(css).toMatch(/\.bc-path-row\s*\{[\s\S]*?background:\s*#f0f0f0/)
  })
})

describe('path-pair-bar fill', () => {
  it('matches capture path-pair-bar fill #f0f0f0', () => {
    expect(css).toMatch(/\.path-pair-bar\s*\{[\s\S]*?background:\s*#f0f0f0/)
  })
})

describe('path actions fill', () => {
  it('matches capture path action fill #f0f0f0', () => {
    expect(pathActions).toMatch(/background:\s*#f0f0f0/)
  })
})
