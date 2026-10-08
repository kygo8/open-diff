#!/usr/bin/env node
/**
 * Ensure .github/release-download-header.md is pinned at the top of a
 * GitHub Release body (insert or refresh the download-guide block).
 *
 * Usage:
 *   node scripts/ensure-release-download-header.mjs <tag>
 * Env:
 *   GH_TOKEN / GITHUB_TOKEN, GITHUB_REPOSITORY (owner/repo)
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const tag = process.argv[2]
if (!tag) {
  console.error('Usage: ensure-release-download-header.mjs <tag>')
  process.exit(1)
}

const repo = process.env.GITHUB_REPOSITORY
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
if (!repo || !token) {
  console.error('GITHUB_REPOSITORY and GH_TOKEN/GITHUB_TOKEN are required')
  process.exit(1)
}

const marker = '## 下载说明 / Which file to download'
const header = `${readFileSync('.github/release-download-header.md', 'utf8').trimEnd()}\n\n`

function gh(args) {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: token },
  })
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout)
    process.exit(result.status || 1)
  }
  return result.stdout
}

const body = gh([
  'release',
  'view',
  tag,
  '--repo',
  repo,
  '--json',
  'body',
  '--jq',
  '.body // ""',
]).replace(/^\uFEFF/, '')

let rest = body
if (rest.trimStart().startsWith(marker)) {
  // Drop the existing pinned block through its trailing --- so we can refresh.
  rest = rest.trimStart().replace(/^## 下载说明 \/ Which file to download[\s\S]*?\n---\s*/, '')
} else {
  rest = rest.replace(
    /^See the assets below to download and install OpenDiff for your platform\.\s*/i,
    '',
  )
}

const nextBody = `${header}${rest.trimStart()}`
if (nextBody === body || nextBody === `${body}\n`) {
  console.log(`Release ${tag} download guide already up to date.`)
  process.exit(0)
}

const edit = spawnSync('gh', ['release', 'edit', tag, '--repo', repo, '--notes', nextBody], {
  encoding: 'utf8',
  env: { ...process.env, GH_TOKEN: token },
})
if (edit.status !== 0) {
  console.error(edit.stderr || edit.stdout)
  process.exit(edit.status || 1)
}
console.log(`Pinned/refreshed download guide at top of release ${tag}.`)
