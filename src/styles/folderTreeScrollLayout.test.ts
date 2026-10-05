import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const folderView = readFileSync(resolve(process.cwd(), 'src/views/FolderCompareView.vue'), 'utf8')

describe('folder compare tree scroll layout', () => {
  it('uses a flex column shell so optional chrome does not steal the 1fr row', () => {
    expect(folderView).toMatch(
      /\.folder-compare-view\s*\{[\s\S]*?display:\s*flex[\s\S]*?flex-direction:\s*column/,
    )
    expect(folderView).toMatch(/\.folder-compare-view\s*\{[\s\S]*?min-height:\s*0/)
    expect(folderView).toMatch(/\.folder-compare-view\s*\{[\s\S]*?overflow:\s*hidden/)
    expect(folderView).toMatch(
      /\.folder-compare-view > :not\(\.folder-tree-table\)\s*\{[\s\S]*?flex:\s*0 0 auto/,
    )
  })

  it('lets the file list grow and scroll inside the remaining height', () => {
    expect(folderView).toMatch(
      /\.folder-tree-table\s*\{[\s\S]*?flex:\s*1 1 auto[\s\S]*?min-height:\s*0[\s\S]*?overflow:\s*auto/,
    )
  })
})
