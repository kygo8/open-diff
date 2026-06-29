import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { commandRegistry } from '@/app/commandRegistry'
import { enUS } from './locales/en-US'

const vueFiles = [
  'src/app/App.vue',
  'src/layouts/AppLayout.vue',
  'src/components/diff/TextDiffPanel.vue',
  'src/components/files/FileOperationConfirmDialog.vue',
  'src/components/files/StructuredErrorPanel.vue',
  'src/components/jobs/JobsProgressPanel.vue',
  'src/components/session/SavedSessionNode.vue',
  'src/views/ClipboardCompareView.vue',
  'src/views/FileFormatView.vue',
  'src/views/FolderCompareView.vue',
  'src/views/FolderMergeView.vue',
  'src/views/FolderSyncView.vue',
  'src/views/HexCompareView.vue',
  'src/views/HomeView.vue',
  'src/views/MediaCompareView.vue',
  'src/views/PictureCompareView.vue',
  'src/views/RegistryCompareView.vue',
  'src/views/RemoteProfileView.vue',
  'src/views/SettingsView.vue',
  'src/views/TableCompareView.vue',
  'src/views/TextCompareView.vue',
  'src/views/TextEditView.vue',
  'src/views/TextMergeView.vue',
  'src/views/VersionCompareView.vue',
]

const visibleAttributeNames = ['aria-label', 'placeholder', 'title']
const templatePattern = /^<template>\r?\n([\s\S]*?)^<\/template>\s*$/m
const quotedValuePattern = /"(.+)"$/

describe('English UI resources', () => {
  it('keeps fixed Vue template UI text behind resource keys', () => {
    const hardcodedText = vueFiles.flatMap(findHardcodedTemplateText)

    expect(hardcodedText).toEqual([])
  })

  it('covers command registry titles and navigation action titles', () => {
    const commandMessageKeys = commandRegistry.flatMap((command) => [
      command.titleKey,
      command.action.type === 'navigate' ? command.action.titleKey : null,
    ])

    expect(commandMessageKeys.filter((key) => key && !enUS.messages[key])).toEqual([])
  })
})

function findHardcodedTemplateText(filePath: string): string[] {
  const source = readFileSync(resolve(process.cwd(), filePath), 'utf8')
  const template = templatePattern.exec(source)?.[1] ?? ''
  const textNodeMatches = [...template.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)].map(
    (match) => `${filePath}: text "${normalize(match[1])}"`,
  )
  const attributeMatches = visibleAttributeNames.flatMap((attributeName) =>
    [
      ...template.matchAll(
        new RegExp(String.raw`(?<![:@])\b${attributeName}="([^"]*[A-Za-z][^"]*)"`, 'g'),
      ),
    ].map((match) => `${filePath}: ${attributeName} "${normalize(match[1])}"`),
  )

  return [...textNodeMatches, ...attributeMatches].filter((entry) => {
    const value = quotedValuePattern.exec(entry)?.[1] ?? ''

    return !entry.includes('data:image/') && !isRouteLiteral(value)
  })
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function isRouteLiteral(value: string): boolean {
  return /^\/[A-Za-z0-9/_-]+$/u.test(value)
}
