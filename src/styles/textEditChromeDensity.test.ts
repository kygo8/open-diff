import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const css = readFileSync(resolve(root, 'src/styles/main.css'), 'utf8')
const editView = readFileSync(resolve(root, 'src/views/TextEditView.vue'), 'utf8')
const layout = readFileSync(resolve(root, 'src/layouts/AppLayout.vue'), 'utf8')
const phrases = readFileSync(resolve(root, 'src/app/statusBarPhrases.ts'), 'utf8')

describe('text edit chrome density', () => {
  it('keeps Text Edit path/toolbar/editor/status chrome at capture CSS scale', () => {
    expect(css).toMatch(/\.text-edit-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(css).toMatch(/\.text-edit-view \.path-toolbar[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.text-edit-view \.path-input[\s\S]*?height:\s*20px/)
    expect(css).toMatch(/\.text-edit-view \.toolbar-button\s*\{[\s\S]*?height:\s*18px/)
    expect(css).toMatch(/\.text-edit-view[\s\S]*?line-height:\s*18px/)

    expect(editView).toMatch(/\.text-edit-view\s*\{[\s\S]*?padding:\s*2px 4px/)
    expect(editView).toMatch(/\.path-toolbar[\s\S]*?min-height:\s*20px/)
    expect(editView).toMatch(/\.path-input[\s\S]*?height:\s*20px/)
    expect(editView).toMatch(/\.toolbar-button\s*\{[\s\S]*?height:\s*18px/)
    expect(editView).toMatch(/:deep\(textarea\)\s*\{[\s\S]*?line-height:\s*18px/)
    expect(editView).toMatch(/source:\s*'text-edit'/)
    expect(editView).toMatch(/SessionSettingsDialog/)
    expect(editView).toMatch(/textEditToolbarOrder/)
    expect(editView).toMatch(/SessionPathActions/)
    expect(editView).toMatch(/PathMetaFooter/)
    expect(editView).not.toMatch(/\.path-input[^}]*height:\s*16px/)

    expect(phrases).toMatch(/EDIT_MODE_SOURCES[\s\S]*?'text-edit'/)
    expect(layout).toMatch(/\.status-bar\[data-chrome-kind='text-session'\][\s\S]*?height:\s*20px/)
    expect(css).toMatch(/\.bc-session-toolbar\s*\{[\s\S]*?min-height:\s*38px/)
  })

  it('keeps Text Edit chrome on capture band with Text Compare path scale', () => {
    expect(css).toMatch(/\.text-edit-view \.syntax-language-bar\s*\{[\s\S]*?min-height:\s*20px/)
    expect(css).toMatch(/\.text-edit-view \.find-input[\s\S]*?height:\s*20px/)
    expect(css).toMatch(/\.text-edit-view \.path-input[\s\S]*?height:\s*20px/)

    expect(editView).toMatch(/\.syntax-language-bar\s*\{[\s\S]*?min-height:\s*20px/)
    expect(editView).toMatch(/\.find-input[\s\S]*?height:\s*20px/)
    expect(editView).toMatch(/\.syntax-preview\s*\{[\s\S]*?line-height:\s*18px/)
    expect(editView).toMatch(/SessionPathActions/)
    expect(editView).toMatch(/PathMetaFooter/)
    expect(editView).toMatch(/bc-path-load/)
  })
})
