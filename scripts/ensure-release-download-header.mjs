#!/usr/bin/env node
/**
 * Prepend .github/release-download-header.md to a GitHub Release body
 * when it is missing, so every release pins the download guide at the top.
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

const body = gh(['release', 'view', tag, '--repo', repo, '--json', 'body', '--jq', '.body // ""'])
const trimmed = body.replace(/^\uFEFF/, '')

if (trimmed.trimStart().startsWith(marker)) {
  console.log(`Release ${tag} already starts with download guide; leaving body unchanged.`)
  process.exit(0)
}

let rest = trimmed.replace(
  /^See the assets below to download and install OpenDiff for your platform\.\s*/i,
  '',
)

const nextBody = `${header}${rest.trimStart()}`
const edit = spawnSync(
  'gh',
  ['release', 'edit', tag, '--repo', repo, '--notes', nextBody],
  {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: token },
  },
)
if (edit.status !== 0) {
  console.error(edit.stderr || edit.stdout)
  process.exit(edit.status || 1)
}
console.log(`Pinned download guide at top of release ${tag}.`)
