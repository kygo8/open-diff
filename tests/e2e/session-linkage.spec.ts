import { expect, test, type Page } from '@playwright/test'
import { installTauriInvokeMock, lastInvoke } from './helpers/tauriMock'

async function assertNoDemoContent(page: Page): Promise<void> {
  const body = await page.locator('body').innerText()

  expect(body).not.toContain('generated-120.log')
  expect(body).not.toContain('line one')
  expect(body).not.toContain('line two')
  expect(body).not.toContain('timeout = 45')
  expect(body).not.toContain('Studio A')
  expect(body).not.toContain('1.4.2')
}

test.beforeEach(async ({ page }) => {
  await installTauriInvokeMock(page)
})

test('home catalog lists implemented sessions and opens text compare', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('home-new-session')).toBeVisible()
  await assertNoDemoContent(page)
  await expect(page.locator('body')).not.toContainText('Compare sample text')
  await expect(page.locator('body')).not.toContainText('Config updated')
  await expect(page.getByTestId('home-how-to-start')).toBeVisible()
  await expect(page.getByTestId('home-edit-selected')).toBeDisabled()
  await page.locator('[data-session-type="text-compare"]').click()
  await expect(page.getByTestId('run-diff')).toBeVisible()
})

test('text compare CTA issues diff_text', async ({ page }) => {
  await page.goto('/compare/text')
  await expect(page.getByTestId('run-diff')).toBeVisible()
  await assertNoDemoContent(page)
  await expect(page.locator('body')).not.toContainText('sample comparison')
  await page.getByTestId('run-diff').click()
  await expect.poll(async () => (await lastInvoke(page, 'diff_text'))?.command).toBe('diff_text')
})

test('folder compare CTA issues compare_folder_paths and keeps unfinished actions disabled', async ({
  page,
}) => {
  await page.goto('/compare/folder')
  await expect(page.getByTestId('run-folder-compare')).toBeVisible()
  await assertNoDemoContent(page)
  await page.getByTestId('folder-left-root').fill('tests/fixtures/folder/left')
  await page.getByTestId('folder-right-root').fill('tests/fixtures/folder/right')
  await page.getByTestId('run-folder-compare').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'compare_folder_paths'))?.command)
    .toBe('compare_folder_paths')
  await expect(page.getByTestId('open-with-selected-file')).toBeDisabled()
  await expect(page.getByTestId('align-with-selected-file')).toBeDisabled()
  await page.getByTestId('preview-sync-plan').click()
  await expect(page.getByTestId('sync-preview-panel')).toBeVisible()
  await page.getByTestId('run-sync-preview').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'execute_folder_sync'))?.command)
    .toBe('execute_folder_sync')
})

test('folder sync CTA issues preview_folder_sync', async ({ page }) => {
  await page.goto('/sync/folder')
  await expect(page.getByTestId('folder-sync-preview')).toBeVisible()
  await page.getByTestId('folder-sync-left-path').fill('tests/fixtures/folder/left')
  await page.getByTestId('folder-sync-right-path').fill('tests/fixtures/folder/right')
  await page.getByTestId('folder-sync-preview').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'preview_folder_sync'))?.command)
    .toBe('preview_folder_sync')
})

test('folder merge CTA issues build_folder_merge_plan', async ({ page }) => {
  await page.goto('/merge/folder')
  await expect(page.getByTestId('folder-merge-build-plan')).toBeVisible()
  await page.getByTestId('folder-merge-left-path').fill('tests/fixtures/folder/left')
  await page.getByTestId('folder-merge-base-path').fill('tests/fixtures/folder/left')
  await page.getByTestId('folder-merge-right-path').fill('tests/fixtures/folder/right')
  await page.getByTestId('folder-merge-output-path').fill('tests/fixtures/folder/right')
  await page.getByTestId('folder-merge-build-plan').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'build_folder_merge_plan'))?.command)
    .toBe('build_folder_merge_plan')
})

test('text merge CTA issues merge_text_files', async ({ page }) => {
  await page.goto('/merge/text')
  await expect(page.getByTestId('load-text-merge')).toBeVisible()
  await assertNoDemoContent(page)
  await page.getByTestId('merge-left-path').fill('tests/fixtures/text/left.txt')
  await page.getByTestId('merge-right-path').fill('tests/fixtures/text/right.txt')
  await page.getByTestId('load-text-merge').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'merge_text_files'))?.command)
    .toBe('merge_text_files')
})

test('table compare CTA issues compare_table', async ({ page }) => {
  await page.goto('/compare/table')
  await expect(page.getByTestId('run-table-compare')).toBeVisible()
  await page.getByTestId('table-left-path').fill('tests/fixtures/table/products-left.csv')
  await page.getByTestId('table-right-path').fill('tests/fixtures/table/products-right.csv')
  await page.getByTestId('run-table-compare').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'compare_table'))?.command)
    .toBe('compare_table')
})

test('hex compare starts empty and issues compare_hex_files', async ({ page }) => {
  await page.goto('/compare/hex')
  await expect(page.getByTestId('run-hex-compare')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('ABCD')
  await page.getByTestId('hex-left-path').fill('tests/fixtures/hex/left.bin')
  await page.getByTestId('hex-right-path').fill('tests/fixtures/hex/right.bin')
  await page.getByTestId('run-hex-compare').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'compare_hex_files'))?.command)
    .toBe('compare_hex_files')
})

test('picture compare CTA issues compare_picture_files without a fake overlay first', async ({
  page,
}) => {
  await page.goto('/compare/picture')
  await expect(page.getByTestId('run-picture-compare')).toBeVisible()
  await expect(page.getByTestId('picture-diff-overlay')).toHaveCount(0)
  await page.getByTestId('picture-left-path').fill('tests/fixtures/picture/left.png')
  await page.getByTestId('picture-right-path').fill('tests/fixtures/picture/right.png')
  await page.getByTestId('run-picture-compare').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'compare_picture_files'))?.command)
    .toBe('compare_picture_files')
})

test('registry compare CTA issues compare_registry_exports', async ({ page }) => {
  await page.goto('/compare/registry')
  await expect(page.getByTestId('run-registry-compare')).toBeVisible()
  await page.getByTestId('run-registry-compare').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'compare_registry_exports'))?.command)
    .toBe('compare_registry_exports')
})

test('media compare CTA issues compare_media_files', async ({ page }) => {
  await page.goto('/compare/media')
  await expect(page.getByTestId('run-media-compare')).toBeVisible()
  await page.getByTestId('media-left-path').fill('tests/fixtures/media/left.mp3')
  await page.getByTestId('media-right-path').fill('tests/fixtures/media/right.mp3')
  await page.getByTestId('run-media-compare').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'compare_media_files'))?.command)
    .toBe('compare_media_files')
})

test('version compare CTA issues compare_version_files', async ({ page }) => {
  await page.goto('/compare/version')
  await expect(page.getByTestId('run-version-compare')).toBeVisible()
  await expect(page.locator('body')).not.toContainText('1.4.2')
  await page.getByTestId('version-left-path').fill('tests/fixtures/version/left.exe')
  await page.getByTestId('version-right-path').fill('tests/fixtures/version/right.exe')
  await page.getByTestId('run-version-compare').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'compare_version_files'))?.command)
    .toBe('compare_version_files')
})

test('text edit CTA issues read_text_file', async ({ page }) => {
  await page.goto('/edit/text')
  await expect(page.getByTestId('text-edit-open')).toBeVisible()
  await page.getByTestId('text-edit-path').fill('tests/fixtures/text/left.txt')
  await page.getByTestId('text-edit-open').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'read_text_file'))?.command)
    .toBe('read_text_file')
})

test('text patch CTA issues apply_text_patch', async ({ page }) => {
  await page.goto('/patch/text')
  await expect(page.getByTestId('apply-text-patch')).toBeVisible()
  await page.getByTestId('apply-text-patch').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'apply_text_patch'))?.command)
    .toBe('apply_text_patch')
})

test('clipboard compare shows capture and compare controls', async ({ page }) => {
  await page.goto('/compare/clipboard')
  await expect(page.getByTestId('clipboard-capture')).toBeVisible()
  await expect(page.getByTestId('clipboard-compare')).toBeVisible()
})

test('reports and scripts issue export and run_script', async ({ page }) => {
  await page.goto('/reports/scripts')
  await expect(page.getByTestId('run-report-export')).toBeVisible()
  await page.getByTestId('report-left-path').fill('tests/fixtures/text/left.txt')
  await page.getByTestId('report-right-path').fill('tests/fixtures/text/right.txt')
  await page.getByTestId('run-report-export').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'export_text_compare_report'))?.command)
    .toBe('export_text_compare_report')
  await page.getByTestId('run-script').click()
  await expect.poll(async () => (await lastInvoke(page, 'run_script'))?.command).toBe('run_script')
})

test('remote profiles keep unfinished protocols disabled and can test SFTP', async ({ page }) => {
  await page.goto('/settings/remote-profiles')
  await expect(page.getByTestId('remote-profile-protocol-select')).toBeVisible()
  await expect(page.getByTestId('remote-profile-protocol-select')).not.toContainText(
    'unimplemented',
  )
  await expect(
    page.locator('[data-testid="remote-profile-protocol-select"] option[value="s3"]'),
  ).toHaveJSProperty('disabled', false)
  await expect(
    page.locator('[data-testid="remote-profile-protocol-select"] option[value="dropbox"]'),
  ).toHaveJSProperty('disabled', true)
  await expect(page.getByTestId('remote-profile-list')).not.toContainText('Prod SFTP')
  await page.getByTestId('new-remote-profile').click()
  await page.getByTestId('remote-profile-name-input').fill('CI SFTP')
  await page.getByTestId('remote-profile-protocol-select').selectOption('sftp')
  await page.getByTestId('remote-profile-host-input').fill('files.example.com')
  await page.getByTestId('remote-profile-root-input').fill('/')
  await page.getByTestId('save-remote-profile').click()
  await expect(page.getByTestId('select-remote-profile-ci-sftp')).toBeVisible()
  await page.getByTestId('select-remote-profile-ci-sftp').click()
  await page.getByTestId('test-remote-profile').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'test_remote_profile'))?.command)
    .toBe('test_remote_profile')
})

test('settings shows follow-system theme and git/svn write controls', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByTestId('theme-follow-system')).toBeVisible()
  await expect(page.getByTestId('write-git-config')).toBeHidden()
  await expect(page.getByTestId('write-svn-config')).toBeHidden()
  await page.getByTestId('options-section-integration').click()
  await expect(page.getByTestId('write-git-config')).toBeVisible()
  await expect(page.getByTestId('write-svn-config')).toBeVisible()
  page.once('dialog', (dialog) => {
    void dialog.accept()
  })
  await page.getByTestId('integration-executable-path').fill('/tmp/open-diff')
  await page.getByTestId('write-git-config').click()
  await expect
    .poll(async () => (await lastInvoke(page, 'write_git_integration'))?.command)
    .toBe('write_git_integration')
})
